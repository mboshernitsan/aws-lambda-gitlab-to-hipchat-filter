# AWS Lambda GitLab-to-HipChat filter

An AWS Lambda function for filtering and transforming GitLab activity web hook invocations and posting notifications to a HipChat room.  We find this cleaner and more flexible than the GitLab's built-in HipChat service.

*Important note:* for this integration, you will need to use HipChat API v1 tokens.  

## Initial set up

This needs to be done once using the AWS CLI commands below or the equivalent AWS Console operations.

```bash

# Set env vars for AWS CLI
$ export AWS_ACCESS_KEY_ID=...
$ export AWS_SECRET_ACCESS_KEY=...
$ export AWS_DEFAULT_REGION=...
$ export AWS_ACCOUNT=...

# Create AIM role for function
...DOC TODO...
$ export AWS_LAMBDA_ROLE_ARN=...

# Create the function itself
$ make output/function.zip
$ aws lambda create-function \
	--function-name postToHipChatFromGitLab \
	--runtime nodejs \
	--role ${AWS_LAMBDA_ROLE_ARN} \
	--handler index.handler \
	--zip-file fileb://output/function.zip
$ export AWS_LAMBDA_FUNCTION_ARN=... # lookup in the output above

# Create the API endpoint
$ aws apigateway create-rest-api \
	--name "gitLablToHipChat"
$ export AWS_APIGATEWAY_ID=... # lookup in the output above

$ aws apigateway get-resources \
	--rest-api-id ${AWS_APIGATEWAY_ID}
$ export AWS_APIGATEWAY_RESOURCE_ID=... # lookup root resource id in the output above

$ aws apigateway put-method \
	--rest-api-id ${AWS_APIGATEWAY_ID} \
	--resource-id ${AWS_APIGATEWAY_RESOURCE_ID} \
	--http-method POST \
	--authorization-type none \
	--request-parameters '{ "method.request.querystring.hipchatToken": false, "method.request.querystring.hipchatRoom": false }'

$ aws apigateway put-integration \
	--rest-api-id ${AWS_APIGATEWAY_ID} \
	--resource-id ${AWS_APIGATEWAY_RESOURCE_ID} \
	--http-method POST \
	--type AWS \
	--integration-http-method POST \
	--uri arn:aws:apigateway:${AWS_DEFAULT_REGION}:lambda:path/2015-03-31/functions/${AWS_LAMBDA_FUNCTION_ARN}/invocations \
	--request-templates '{ "application/json": "{\"hipchatToken\" : \"$util.urlDecode($input.params('\''hipchatToken'\''))\", \"hipchatRoom\" : \"$util.urlDecode($input.params('\''hipchatRoom'\''))\", \"activity\" : $input.json('\''$'\'')}"}'

$ aws apigateway put-integration-response \
	--rest-api-id ${AWS_APIGATEWAY_ID} \
	--resource-id ${AWS_APIGATEWAY_RESOURCE_ID} \
	--http-method POST \
	--status-code 200 \
	--response-templates '{ "application/json": "" }'

$ aws apigateway put-method-response \
	--rest-api-id ${AWS_APIGATEWAY_ID} \
	--resource-id ${AWS_APIGATEWAY_RESOURCE_ID} \
	--http-method POST \
	--status-code 200 \
	--response-models '{ "application/json": "Empty" }'

$ aws apigateway create-deployment \
	--rest-api-id ${AWS_APIGATEWAY_ID} \
    --stage-name prod

$ aws lambda add-permission \
	--function-name postToHipChatFromGitLab \
	--statement-id 1 \
	--action lambda:InvokeFunction \
	--principal apigateway.amazonaws.com \
	--source-arn "arn:aws:execute-api:${AWS_DEFAULT_REGION}:${AWS_ACCOUNT}:${AWS_APIGATEWAY_ID}/*/POST/"

$ export AWS_LAMBDA_FUNCTION_URL=https://${AWS_APIGATEWAY_ID}.execute-api.${AWS_DEFAULT_REGION}.amazonaws.com/prod
```

## Development loop

After the steps above, it should be possible run make to deploy and test the function (after setting HIPCHAT_TOKEN and HIPCHAT_ROOM):

```bash
$ make deploy
$ HIPCHAT_TOKEN=... HIPCHAT_ROOM=... make posttest
```

(If your HipChat room name contains non-URL-safe characters (such as spaces), it will need to be URL-encoded for the above to work).

Alternatively, you can run the tests locally without deploying:

```bash
$ HIPCHAT_TOKEN=... HIPCHAT_ROOM=... make localtest
```

Both tests will use the fixtures declared inside the Makefile.  ```make localtest``` will also validate the logic for skipping certain state transitions that we didn't find useful to blast to the team.

## Integrate into GitLab

To integrate your filter into your GitLab project, add the following web hook URL on the project's Web Hooks page:

```bash
$(AWS_LAMBDA_FUNCTION_URL)?hipchatToken=...&hipchatRoom=...
```

Again, remember to use your HipChat API v1 token and URL-encode the room name, if necessary.



