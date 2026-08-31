# Bill’s Premiere Car Rental

A responsive Angular 21 operations dashboard for a car-rental business. It uses standalone components, signals, lazy-loaded routes, route guards, reactive forms, and Angular Material.

## Features

- Public company landing page with featured vehicles, benefits, reviews, and calls-to-action
- Customer booking journey with vehicle selection and a date-range calendar
- Live rental pricing with daily rate, optional coverage, taxes, and total
- Validated customer details and booking confirmation reference
- Stripe card payment during booking, with server-calculated totals and payment verification
- Amazon Cognito login, invitation-based staff onboarding, password challenges, token refresh, and password recovery
- Operations dashboard with fleet, revenue, and booking summaries
- Searchable, filterable vehicle inventory
- Booking management view
- User management with role filters, invitations, editing, suspension, and removal
- API-backed persistence for fleet, bookings, and team access
- Responsive desktop and mobile navigation

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:4200` for the customer website, or `http://localhost:4200/login` for the staff portal.

## AWS backend

The deployed `car-rental` stack in the `billspremierarvin` account in `us-east-2` contains:

- A Cognito user pool and public web client
- An API Gateway REST API with public vehicle/booking routes and Cognito-protected staff routes
- A Python Lambda backend
- Encrypted, point-in-time-recoverable DynamoDB vehicle and booking tables
- A private, encrypted S3 bucket for uploaded vehicle photos

The current development configuration is in `src/environments/environment.ts`. User profiles, roles, invitations, suspensions, and deletion are managed directly in Cognito; they are not duplicated in DynamoDB.

### Deploy or update

PowerShell:

```powershell
.\infrastructure\deploy.ps1 -Profile billspremierarvin -Region us-east-2
```

To enable payments, create Stripe test-mode API keys, set them for the current PowerShell session, and deploy:

```powershell
$env:STRIPE_PUBLISHABLE_KEY = "pk_test_..."
$env:STRIPE_SECRET_KEY = "sk_test_..."
.\infrastructure\deploy.ps1 -Profile billspremierarvin -Region us-east-2
```

Delivery-address geocoding and pickup maps use Amazon Location Service. The deployment creates a browser API key restricted to the configured site referers and writes it to the Angular environment file; Lambda geocoding uses its IAM role and does not need an API key. The Stripe secret is sent only to the Lambda environment, while the safe Stripe publishable key is written to the Angular environment file. Do not commit secret keys or place them in frontend code.

### Test a payment

1. Make sure the deployed stack uses Stripe **test-mode** keys, then run `npm start`.
2. Open `http://localhost:4200/book`, choose a vehicle and valid future dates, and complete the customer fields.
3. For a successful payment, enter card `4242 4242 4242 4242`, any future expiry such as `12/34`, any three-digit CVC, and any postal code.
4. To test a decline, use `4000 0000 0000 9995` with the same kind of expiry, CVC, and postal code.
5. Confirm that a successful payment displays a booking reference, appears as succeeded in the Stripe test dashboard, and creates a DynamoDB booking with `paymentStatus: Paid` and its `paymentIntentId`.

Never enter a real card while using test mode. See [Stripe's test-card documentation](https://docs.stripe.com/testing) for more scenarios, including 3D Secure.

To send the first Cognito administrator invitation during a fresh deployment:

```powershell
.\infrastructure\deploy.ps1 -AdminEmail you@example.com
```

The script packages the Lambda, deploys CloudFormation, and writes the stack outputs into the Angular environment file. The `main` branch is hosted by the existing AWS Amplify app at `https://billspremiere.com` (with `https://main.d3dhhi3hlacwg9.amplifyapp.com` as its Amplify URL); both domains and `https://www.billspremiere.com` are included in the default API and photo-upload CORS allowlist. Multiple additional frontend origins can also be allowlisted:

```powershell
.\infrastructure\deploy.ps1 `
  -Profile billspremierarvin `
  -Region us-east-2 `
  -AllowedOrigins "http://localhost:4200","https://rentals.example.com" `
  -AllowedMapReferers "http://localhost:4200/*","https://rentals.example.com/*"
```

Amplify automatically builds and deploys the frontend when changes are pushed to the GitHub `main` branch. To redeploy the current commit without a new push, start a release job in the Amplify console or with the AWS CLI.

### Authorization

- Public: list vehicles and create customer bookings
- Administrator, Manager, Agent: fleet and booking operations
- Administrator only: list, invite, edit, suspend, reactivate, and remove Cognito users

Newly invited users sign in with their emailed temporary password and are prompted to choose a permanent one. The password policy requires at least 12 characters including uppercase, lowercase, number, and symbol.

Up to 15 vehicle photos can be uploaded from the **Add vehicle** dialog as JPEG, PNG, or WebP files. Photos are cropped to 16:9 and oversized files are automatically resized and compressed below 8 MB before the browser uploads them directly to the private S3 bucket with five-minute signed URLs. Customer-facing image requests use short-lived read URLs generated by the backend.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
