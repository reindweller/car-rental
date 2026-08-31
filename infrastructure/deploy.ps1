param(
  [string]$Profile = "billspremierarvin",
  [string]$Region = "us-east-2",
  [string]$StackName = "car-rental",
  [string]$ArtifactBucket = "car-rental-artifacts-585949318267-us-east-2",
  [string[]]$AllowedOrigins = @(
    "http://localhost:4200",
    "https://main.d3dhhi3hlacwg9.amplifyapp.com",
    "https://billspremiere.com",
    "https://www.billspremiere.com"
  ),
  [string[]]$AllowedMapReferers = @(
    "http://localhost:4200/*",
    "https://main.d3dhhi3hlacwg9.amplifyapp.com/*",
    "https://billspremiere.com/*",
    "https://www.billspremiere.com/*"
  ),
  [string]$StripePublishableKey = $env:STRIPE_PUBLISHABLE_KEY,
  [string]$StripeSecretKey = $env:STRIPE_SECRET_KEY,
  [string]$AdminEmail = ""
)

$ErrorActionPreference = "Stop"
$InfrastructureRoot = $PSScriptRoot
$PackagedTemplate = Join-Path $InfrastructureRoot ".packaged-template.yaml"

aws cloudformation package `
  --template-file (Join-Path $InfrastructureRoot "template.yaml") `
  --s3-bucket $ArtifactBucket `
  --output-template-file $PackagedTemplate `
  --profile $Profile `
  --region $Region

function Deploy-Stack([string[]]$Origins) {
  $ParameterOverrides = @(
    "AllowedOrigins=$($Origins -join ',')",
    "AllowedMapReferers=$($AllowedMapReferers -join ',')"
  )
  if ($StripePublishableKey) { $ParameterOverrides += "StripePublishableKey=$StripePublishableKey" }
  if ($StripeSecretKey) { $ParameterOverrides += "StripeSecretKey=$StripeSecretKey" }

  aws cloudformation deploy `
    --template-file $PackagedTemplate `
    --stack-name $StackName `
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND `
    --parameter-overrides $ParameterOverrides `
    --no-fail-on-empty-changeset `
    --profile $Profile `
    --region $Region
}

function Read-StackOutputs {
  return aws cloudformation describe-stacks `
    --stack-name $StackName `
    --profile $Profile `
    --region $Region `
    --query "Stacks[0].Outputs" | ConvertFrom-Json
}

Deploy-Stack $AllowedOrigins

$Outputs = Read-StackOutputs

function Get-Output([string]$Key) {
  return ($Outputs | Where-Object OutputKey -eq $Key).OutputValue
}

$LocationMapApiKey = aws location describe-key `
  --key-name (Get-Output "LocationMapApiKeyName") `
  --profile $Profile `
  --region $Region `
  --query Key `
  --output text

$EnvironmentPath = Join-Path (Split-Path $InfrastructureRoot) "src\environments\environment.ts"
$EnvironmentContent = @"
export const environment = {
  production: false,
  aws: {
    region: '$(Get-Output "Region")',
    userPoolId: '$(Get-Output "UserPoolId")',
    userPoolClientId: '$(Get-Output "UserPoolClientId")',
    apiUrl: '$(Get-Output "ApiUrl")',
  },
  stripe: {
    publishableKey: '$(Get-Output "StripePublishableKey")',
  },
  amazonLocation: {
    apiKey: '$LocationMapApiKey',
  },
};
"@
[System.IO.File]::WriteAllText($EnvironmentPath, $EnvironmentContent)

if ($AdminEmail) {
  $PoolId = Get-Output "UserPoolId"
  aws cognito-idp admin-create-user `
    --user-pool-id $PoolId `
    --username $AdminEmail `
    --user-attributes Name=email,Value=$AdminEmail Name=email_verified,Value=true Name=name,Value="Workspace Administrator" Name=custom:role,Value=Administrator `
    --desired-delivery-mediums EMAIL `
    --profile $Profile `
    --region $Region
}

Write-Host "Stack deployed and src/environments/environment.ts updated."
Write-Host "API: $(Get-Output "ApiUrl")"
Write-Host "User pool: $(Get-Output "UserPoolId")"
Write-Host "Amplify frontend: https://main.d3dhhi3hlacwg9.amplifyapp.com"
