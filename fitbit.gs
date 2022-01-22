const fitbit = {
  "serviceName": "Fitbit",
  "clientId": PropertiesService.getScriptProperties().getProperty('FITBIT_API_CLIENT_ID'),
  "clientSecret": PropertiesService.getScriptProperties().getProperty('FITBIT_API_CLIENT_SECRET'),
  "setAuthorizationBaseUrl": "https://www.fitbit.com/oauth2/authorize",
  "tokenUrl": "https://api.fitbit.com/oauth2/token",
  "dataSourceUrl": "https://www.googleapis.com/fitness/v1/users/me/dataSources",
  "callback": "fbAuthCallback",
  "scope": "weight"
}

/**
 * Fitbit用の認証サービスを取得する。
 */
const getFBService = () => {
  return OAuth2.createService(fitbit.serviceName)
    .setAuthorizationBaseUrl(fitbit.setAuthorizationBaseUrl)
    .setTokenUrl(fitbit.tokenUrl)
    .setClientId(fitbit.clientId)
    .setClientSecret(fitbit.clientSecret)
    .setCallbackFunction(fitbit.callback)
    .setPropertyStore(property)
    .setScope(fitbit.scope)
    .setTokenHeaders({'Authorization': 'Basic ' + Utilities.base64Encode(fitbit.clientId + ':' + fitbit.clientSecret)});
}

function fbAuthCallback(request) {
  var service = getFBService();
  var isAuthorized = service.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}