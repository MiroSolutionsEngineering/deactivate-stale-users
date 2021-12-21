var express = require('express');
var dotenv = require('dotenv-safe').config();
var fetch = require('node-fetch');
var fs = require('file-system');
var app = express();

async function init() {

    /* Function to call APIs */
    async function callAPI(url, options, apiType) {

        async function manageErrors(response) {
            if(!response.ok){
                var parsedResponse = await response.json();
                var responseError = {
                    status: response.status,
                    statusText: response.statusText,
                    requestUrl: response.url,
                    errorDetails: parsedResponse
                };
                if (apiType === 'scim') {
                    var reqUrlPath = response.url.split('/');
                    reqUrlPath = reqUrlPath[7].split('?');
                    userEmail = reqUrlPath[1].split('&email=');
                    responseError.userId = reqUrlPath[0];
                    responseError.email = userEmail[1];
                }
                throw(responseError);
            }
            return response;
        }

        var response = await fetch(url, options)
        .then(manageErrors)
        .then((res) => {
            if (res.ok) {
                var rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
                return res[res.status == 204 ? 'text' : 'json']().then((data) => ({ status: res.status, rate_limit_remaining: rateLimitRemaining, body: data }));
            }
        })
        .catch((error) => {
            if (apiType === 'scim') {
                throw(error);
            }
            else {
                console.error('Error:', error);
            }
            return error;
        });
        return response;
    }

    /* Async function to hold script execution for 61 seconds when API rate limit has been reached (error code 429) */
    var delay = ms => new Promise(res => setTimeout(res, ms));
    var holdScriptExecution = async (ms) => {
        console.log('**** Rate limit of REST API reached -- Waiting 61 seconds to continue requests - Current time: ' + new Date() + '***');
        await delay(ms);
        console.log('**** Resumming script execution ***');
    };

    /* Function to get active stale users using Miro's Organization API */
    async function getActiveStaleUsers(url, reqOptions, orgId, staleUsersArray, lastAcceptedDate) {
        var activeUsers = await callAPI(url,reqOptions);
        if (activeUsers.status === 200) {
            for(var a=0; a < activeUsers.body.data.length; a++) {
                if (typeof(activeUsers.body.data[a].lastActivityAt) !== 'undefined') {
                    if(activeUsers.body.data[a].lastActivityAt < lastAcceptedDate) {
                        staleUsersArray.push(activeUsers.body.data[a]);
                    }
                } 
            }

            /* Re-call organizations API if the results returned are 100 - This implies there are further results to retrieve */
            if (activeUsers.body.size === 100) {
                var lastUserOfpreviousResponse = activeUsers.body.data[activeUsers.body.data.length - 1].id;
                var url = `https://api.miro.com/vNext/organizations/${orgId}/members?active=true&cursor=${lastUserOfpreviousResponse}`;
                if (activeUsers.rate_limit_remaining === 0) {
                    await holdScriptExecution(61000);
                }
                return await getActiveStaleUsers(url,reqOptions, orgId, staleUsersArray, lastAcceptedDate);
            }
            else {
                var staleUsers = {
                    status: 'ok',
                    data: staleUsersArray
                };
                console.log('----------- Stale Active Users - BEGIN ------------');
                var content = JSON.stringify(staleUsersArray, null, '\t');
                console.log(content);
                var fileName = 'output_files/stale_users_' + (+new Date()) + '_.json';
                fs.writeFile(fileName, content, function(err) {});
                console.log('----------- Stale Active Users - END ------------');
                return staleUsers;
            }
            
        }
        else if (activeUsers.status === 429) {
            await holdScriptExecution(61000);
            return await getActiveStaleUsers(url,reqOptions, orgId, staleUsersArray, lastAcceptedDate);
        }
        else {
            console.log('**** ERORR *** - A request while retrieving stale users failed - Please check errors above and below ***');
            console.log(activeUsers);
            return activeUsers;
        }
    }

    /* Function to deactivate Users using Miro's SCIM API */
    async function deactivateUsers(urls, scimReqOptions, errorsArray) {
        var result;
        var deactivateUsers = await Promise.all(urls.map(async url => {
            try {
                var response = await callAPI(url, scimReqOptions, 'scim');
                return response;
            }
            catch (error) {
                console.error('Error:', error);
                return error;
            }
            return 
        }))
        .then(function(results) {
            result = results;
        });

        if (result.length > 0) {
            var failedRequestsDueToTooManyRequests = [];
            var failedRequestsDueToConflict = [];
            var otherFailedRequests = [];
            var successfullRequests = [];
            for(var c=0; c < result.length; c++) {
                if(result[c].status === 429) {
                    failedRequestsDueToTooManyRequests.push(result[c]);
                }
                else if (result[c].status === 409) {
                    failedRequestsDueToConflict.push(result[c]);
                }
                else if (result[c].status === 200) {
                    successfullRequests.push(result[c]);
                }
                else {
                    otherFailedRequests.push(result[c]);
                }
            }
            if (failedRequestsDueToConflict.length > 0) {
                console.log('**** WARNING ****: There are failed requests due to "Conflict" (error 409 - "Any team in organization must have at least one admin") - Please check manually the output file "conflict_users.json" and/or the list below ***');
                var content = JSON.stringify(failedRequestsDueToConflict, null, '\t');
                console.log(content);
                var fileName = 'output_files/conflict_users_' + (+new Date()) + '_.json';
                fs.writeFile(fileName, content, function(err) {});
            }
            if (otherFailedRequests.length > 0) {
                console.log('**** WARNING ****: There are failed requests with a different response code than 429 or 409 - Please check manually the output file "other_failed_requests.json" and/or the list below ***');
                var content = JSON.stringify(otherFailedRequests, null, '\t');
                console.log(content);
                var fileName = 'output_files/other_failed_requests_' + (+new Date()) + '_.json';
                fs.writeFile(fileName, content, function(err) {});
            }
            if (successfullRequests.length > 0) {
                console.log('**** The below users were successfully deactivated - See full details of deactivated users in the output file "deactivated_users.json" or in the list below ***');
                var content = JSON.stringify(successfullRequests, null, '\t');
                console.log(content);
                var fileName = 'output_files/deactivated_users_' + (+new Date()) + '_.json';
                fs.writeFile(fileName, content, function(err) {});
            }
            if (failedRequestsDueToTooManyRequests.length > 0) {
                await holdScriptExecution(61000);
                return await deactivateUsers(urls, scimReqOptions, failedRequestsDueToTooManyRequests);
            }
        }
        return result;
    }

    var ORG_API_TOKEN = process.env.ORGANIZATIONS_API_KEY;
    var SCIM_API_TOKEN = process.env.SCIM_API_KEY;
    var orgId = process.env.MIRO_ORGANIZATION_ID;
    var orgUrl = `https://api.miro.com/vNext/organizations/${orgId}/members?active=true`;

    /* Number of days of inactivity a user must have to be considered "stale" */
    var days = 61;
    var today = new Date();
    var priorDate = new Date().setDate(today.getDate() - days)
    var lastAcceptedDate = new Date(priorDate).toISOString();

    var orgReqHeaders = {
        'accept': '*/*',
        'cache-control': 'no-cache',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ORG_API_TOKEN
    };
    var orgReqOptions = {
        method: 'GET',
        headers: orgReqHeaders,
        body: null
    };

    var staleUsers = await getActiveStaleUsers(orgUrl, orgReqOptions, orgId, [], lastAcceptedDate);

    if (staleUsers.status === 'ok') {
        if (staleUsers.data.length > 0) {
            var urls = [];
            for(var b=0; b < staleUsers.data.length; b++) {
                var url = 'https://miro.com/api/v1/scim/Users/' + staleUsers.data[b].id + '?attributes=id,userName,active&email=' + staleUsers.data[b].email;
                urls.push(url);
            }

            var scimReqHeaders = {
                'cache-control': 'no-cache',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + SCIM_API_TOKEN
            };
            var raw = JSON.stringify({
                "schemas": [
                    "urn:ietf:params:scim:api:messages:2.0:PatchOp"
                ],
                "Operations": [{
                    "op": "Replace",
                    "path": "active",
                    "value": false
                }]
            });
            var scimReqOptions = {
                method: 'PATCH',
                headers: scimReqHeaders,
                body: raw
            };

            var deactivatedUsers = await deactivateUsers(urls, scimReqOptions, []);
        }
        else {
            console.log('====== No stale users to deactivate =====');
            var fileName = 'output_files/deactivated_users_' + (+new Date()) + '_.json';
            var result = '[]';
            fs.writeFile(fileName, result, function(err) {});
        }
    }
    else {
        console.log('**** ERORR *** - Retrieving stale users failed - Please check errors above');
    }
    console.log('====== END OF SCRIPT - Please review output files located in the "output_files" folder ======');
}
init();
