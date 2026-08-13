param(
  [string]$Profile = "reindweller",
  [string]$Region = "ap-southeast-1",
  [string]$StackName = "car-rental",
  [string]$ArtifactBucket = "cdk-hnb659fds-assets-512869302206-ap-southeast-1",
  [string[]]$AllowedOrigins = @("http://localhost:4200"),
  [string]$StripePublishableKey = $env:STRIPE_PUBLISHABLE_KEY,
  [string]$StripeSecretKey = $env:STRIPE_SECRET_KEY,
  [string]$AdminEmail = ""
)

$ErrorActionPreference = "Stop"
$InfrastructureRoot = $PSScriptRoot
$PackagedTemplate = Join-Path $InfrastructureRoot ".packaged-template.yaml"
$AllowedOriginsValue = $AllowedOrigins -join ","

aws cloudformation package `
  --template-file (Join-Path $InfrastructureRoot "template.yaml") `
  --s3-bucket $ArtifactBucket `
  --output-template-file $PackagedTemplate `
  --profile $Profile `
  --region $Region

aws cloudformation deploy `
  --template-file $PackagedTemplate `
  --stack-name $StackName `
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND `
  --parameter-overrides "AllowedOrigins=$AllowedOriginsValue" "StripePublishableKey=$StripePublishableKey" "StripeSecretKey=$StripeSecretKey" `
  --no-fail-on-empty-changeset `
  --profile $Profile `
  --region $Region

$Outputs = aws cloudformation describe-stacks `
  --stack-name $StackName `
  --profile $Profile `
  --region $Region `
  --query "Stacks[0].Outputs" | ConvertFrom-Json

function Get-Output([string]$Key) {
  return ($Outputs | Where-Object OutputKey -eq $Key).OutputValue
}

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
