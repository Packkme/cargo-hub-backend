# Repository Guidelines

## Project Structure & Module Organization
`app.js` is the entrypoint, wiring Express config from `config/` and database bootstrapping in `database/`. HTTP contracts live in `Routes/`, controllers handle request logic in `controllers/`, and business rules sit in `services/`. Persistence details belong to `models/`, validations to `validations/`, middleware to `middleware/`, and shared helpers to `utils/`. Tests live under `tests/` (`unit`, `integration`, plus suites in `tests/controllers` and `tests/services`). Postman collections sit in `Postman/`, email templates in `templates/`, and migration or seed scripts in `scripts/`.

## Build, Test, and Development Commands
Install dependencies via `npm install`. `npm run dev` starts the API with nodemon, while `npm start` provides the production profile. Run `npm run migrate` (and `npm run migrate:rollback <version>`) for schema changes, and `npm run seed` for initial data. Quality gates are `npm test`, `npm run test:unit`, and `npm run test:integration`; append `:coverage` for LCOV output or `test:watch` while iterating.

## Coding Style & Naming Conventions
JavaScript files use 4-space indentation, single quotes, and trailing semicolons, mirroring `app.js`. Keep modules focused: `controllers/<resource>Controller.js`, `services/<Resource>Service.js`, and `models/<resource>.model.js`. Prefer descriptive nouns for Mongo collections, PascalCase for classes, and camelCase for functions or variables. Align validation schemas with Joi patterns already present in `validations/`.

## Testing Guidelines
Jest is configured via `jest.config.js`, with shared fixtures in `tests/setup.js` and helper utilities in `tests/testHelpers.js`. Name specs `*.test.js` so they are discovered (e.g., `tests/services/UserService.test.js`). Use the in-memory Mongo helpers to isolate tenants and cover both success and failure flows. Keep the 60% coverage floor by running `npm run test:coverage` before each pull request.

## Commit & Pull Request Guidelines
Follow the lightweight convention in `git log`: short imperative subjects that name the area (e.g., `transactions: tighten controller validation`). Squash noisy WIP commits locally. Pull requests must describe the change, link related issues, and list verification steps (`npm test`, migration commands). Provide screenshots or cURL snippets for API updates and call out schema or env-var changes early.

## Security & Configuration Tips
Copy `.env.example` to `.env`, then provide Mongo credentials, JWT secrets, and S3 keys. Helmet, rate limiting, and request-context middleware are enabled in `config/express.js`; new routes should reuse those middlewares instead of patching around them. Never commit secrets—`config/` stores defaults only, while real credentials stay in the environment or your secret manager.
