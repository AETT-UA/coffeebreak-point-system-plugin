# Coffeebreak point-system plugin

This is a plugin for [coffeeBreak](https://github.com/PI-coffeeBreak) (Modular Event Management
System) that aims to integrate with [Point System](https://github.com/AETT-UA/point-system) (a transaction system for gamified event entry).
The Point System exposes a set of HTTP endpoints for performing transactions and managing multiple leaderboards.
The plugin allows not only for administrator management of the system but also for automatic execution of transitions by listening for events asynchronously.

## Transaction templates

_ROLE_ : manage_transaction_templates

#### Endpoints

- `GET /point-system/transaction-templates`: Get all transaction templates.
- `GET /point-system/transaction-templates/{id}`: Get a transaction template by ID.
- `POST /point-system/transaction-templates`: Create a new transaction template.
- `PATCH /point-system/transaction-templates/{id}`: Update a transaction template by ID.
