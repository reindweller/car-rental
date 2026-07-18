# Bill’s Premiere Car Rental

A responsive Angular 21 operations dashboard for a car-rental business. It uses standalone components, signals, lazy-loaded routes, route guards, reactive forms, and Angular Material.

## Features

- Public company landing page with featured vehicles, benefits, reviews, and calls-to-action
- Customer booking journey with vehicle selection and a date-range calendar
- Live rental pricing with daily rate, optional coverage, taxes, and total
- Validated customer details and booking confirmation reference
- Demo login and protected application routes
- Operations dashboard with fleet, revenue, and booking summaries
- Searchable, filterable vehicle inventory
- Booking management view
- User management with role filters, invitations, editing, suspension, and removal
- Browser-local persistence for the demo session and team changes
- Responsive desktop and mobile navigation

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:4200` for the customer website, or `http://localhost:4200/login` for the staff portal. Sign in with `admin@billspremiere.com` and any password of at least six characters.

## Production integration

The demo services in `src/app/core` intentionally isolate authentication and data access. Replace their local-storage and in-memory implementations with `HttpClient` calls to connect a backend without changing the feature components.

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
