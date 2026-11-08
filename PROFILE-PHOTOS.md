# Employee profile pictures

From Employees, choose Add employee or Edit employee. Select a JPG, PNG or WebP (up to 5 MB), check the square preview, and choose Save changes. Remove photo takes effect when saved; Cancel discards the change.

Photos are resized to 160 × 160 pixels and stored in MySQL with the employee. They appear beside employee names in employee, attendance and report tables. They are separate from face verification enrollment.

## Update an existing Windows installation

Stop the running attendance app. Open Command Prompt inside the project folder containing package.json:

```cmd
git pull --ff-only origin main
npm run db:migrate
start-windows.cmd
```

Use the existing .env for the correct database. Migration 004 adds the profile photo table; it does not delete or replace employees or attendance. Back up the database before applying schema updates.

For cloud deployments, run the migration against the app's database before starting the updated app. Keep existing database credentials and face encryption key.
