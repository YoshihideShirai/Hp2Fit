const DATE_OF_MEASUREMENT = "1";
const BODY_WEIGHT = "6021";
const BODY_FAT = "6022";

const healthPlanet = {
  "serviceName": "HealthPlanet",
  "clientId": PropertiesService.getScriptProperties().getProperty('HEALTHPLANET_API_CLIENT_ID'),
  "clientSecret": PropertiesService.getScriptProperties().getProperty('HEALTHPLANET_API_CLIENT_SECRET'),
  "setAuthorizationBaseUrl": "https://www.healthplanet.jp/oauth/auth",
  "tokenUrl": "https://www.healthplanet.jp/oauth/token",
  "innerscanUrl": "https://www.healthplanet.jp/status/innerscan.json",
  "callback": "hpAuthCallback",
  "scope": "innerscan",
  "grantType": "authorization_code",
  "payloadDate": DATE_OF_MEASUREMENT,
  "payloadTag": `${BODY_WEIGHT},${BODY_FAT}`
}

/**
 * HealthPlanet用の認証サービスを取得する。
 */
const getHPService = () => {
  return OAuth2.createService(healthPlanet.serviceName)
    .setAuthorizationBaseUrl(healthPlanet.setAuthorizationBaseUrl)
    .setTokenUrl(healthPlanet.tokenUrl)
    .setClientId(healthPlanet.clientId)
    .setClientSecret(healthPlanet.clientSecret)
    .setCallbackFunction(healthPlanet.callback)
    .setPropertyStore(property)
    .setScope(healthPlanet.scope)
    .setGrantType(healthPlanet.grantt);
}

/**
 * HealthPlanetのOAuth認証が完了したときに呼ばれるコールバック関数。
 */
const hpAuthCallback = (request) => {
  const hpService = getHPService();
  const isAuthorized = hpService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("Success!");
  } else {
    return HtmlService.createHtmlOutput("Denied.");
  }
}

/**
 * HealthPlanetから体重データを取得する。
 */
const fetchHealthData = (service) => {
  const payload = {
    "access_token": service.getAccessToken(),
    "date": healthPlanet.payloadDate,
    "tag": healthPlanet.payloadTag,
    "from": dayjs.dayjs().subtract(3, "month").format("YYYYMMDDHHmmss")
  };

  const options = {
    "method": "POST",
    "payload": payload,
  };

  const response = UrlFetchApp.fetch(healthPlanet.innerscanUrl, options);
  return JSON.parse(response);
}
