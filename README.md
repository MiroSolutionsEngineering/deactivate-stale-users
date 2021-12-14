## Introduction

This example explains how to retrieve and deactivate inactive/stale users using Miro REST and SCIM APIs.

### Script flow

<img src="images/script_flow.jpg" alt="Script data flow" />
 
## Preparation

### Step 1. Ensure SCIM and Organization API is enabled

- To use the app in this repository, SCIM must be enabled in the respective Miro account.

- Make sure the Organization API is enabled for the respective account. This can be requested with your Customer Success Manager at Miro.

### Step 2. Clone the repo and install the dependencies

```bash
git clone https://github.com/MiroSolutionsEngineering/deactivate-stale-users.git
npm install
```

### Step 3. Copy `.env` file

```bash
cp .env.example .env
```

### Step 4. Create App in Miro

- This [guide](https://developers.miro.com/docs/getting-started) shows you how to do it.

- [Scopes](https://developers.miro.com/reference#scopes) used in this example: `organizations:read`

- Install the application and add the received Miro OAuth token in the `.env` file

### Step 5. Get the SCIM API Token

- In your Miro account go to `Settings > Security` and copy the SCIM API token

- Add the Miro SCIM API token in the `.env` file


### Step 6. Adjust the number of days a user must be inactive to be considered as "stale"

- Within the file `index.js` locate line 184 and adjust the value of the variable `days`. By default it's set to 61 days.


### Step 7. Start Node server locally

```bash
npm start
```

## Expected results

Once the script runs the results will be available in the local folder `output_files`. There you will find the below files:

- `stale_users_(unique-timestamp)_.json`: An array of a stale users (before deactivation).

- `deactivated_users_(unique-timestamp)_.json`: An array of a users that got successfully deactivated by the app.

- `conflict_users_(unique-timestamp)_.json`: An array of users that could not be deactivated because they are the last Team Admin in at least one of the Miro Teams they belong to. Since every Team within a Miro organization must have a least one Team Admin, the SCIM API returns a `409` error when attempting to deactivate a user that is the last Team Admin of a Team. This array of conflict users allows you to review manually and act accordingly.

- `other_failed_requests_(unique-timestamp)_.json`: An array of users that could not be deactivated due other errors that are not `409: Any account in organization must have at least one admin` or `429: Too many requests`. The array contains detailed information about the failed request (such as: userId, email, request URL, error code, error message).

## Expected errors

The SCIM API can return the below **expected** errors:

- `409`: Received when the user to downgrade is the last Team Admin of Miro Team. **Message**: `Any account in organization must have at least one admin`. In this case a file named `conflict_users_(unique-timestamp)_.json` will be created containing the users that could not be deactivated for you to review manually and act accordingly. 

- `429`: Received when the amount of requests made exeeds the SCIM API rate limit. **Message**: `Too many requests`. When this occurs, the script automatically holds execution for 61 seconds and then resumes execution automatically, there is no action needed from your side. To learn more about Miro's SCIM API rate limits, click [here](https://developers.miro.com/docs/scim-rate-limits).

- To see a full list of all possible errors, click [here](https://developers.miro.com/docs/scim-errors).
