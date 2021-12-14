## Introduction

This example explains how to retrieve and deactivate inactive/stale users using Miro REST and SCIM APIs.

### Script flow

<img src="images/script_flow.jpg" alt="Script data flow" />
 
## Preparation

### Step 1. Ensure SCIM and Organization API is enabled

- To use the script in this repository, SCIM must be enabled in the respective Miro account.

- Make sure the Organization API is enabled for the respective account. This can be requested with your Customer Success Manager at Miro.

### Step 2. Clone the repo and install the dependencies

```bash
git clone https://github.com/LuisSantosColman/miro-deactivate-stale-users.git
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

- In your Miro account go to "Security" and copy the SCIM API token

- Add the Miro SCIM API token in the `.env` file


### Step 6. Adjust the number of days a user must be inactive to be considered as "stale"

- Within the file `index.js` locate line 184 and adjust the value of the variable `days`. By default it's set to 61 days.


### Step 7. Start Node server locally

```bash
npm start
```