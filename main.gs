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

const googleFit = {
  "serviceName": "GoogleFit",
  "clientId": PropertiesService.getScriptProperties().getProperty('GOOGLE_API_CLIENT_ID'),
  "clientSecret": PropertiesService.getScriptProperties().getProperty('GOOGLE_API_CLIENT_SECRET'),
  "setAuthorizationBaseUrl": "https://accounts.google.com/o/oauth2/auth",
  "tokenUrl": "https://oauth2.googleapis.com/token",
  "dataSourceUrl": "https://www.googleapis.com/fitness/v1/users/me/dataSources",
  "callback": "gfAuthCallback",
  "scope": "https://www.googleapis.com/auth/fitness.body.write",
  "weight": "com.google.weight",
  "fat": "com.google.body.fat.percentage"
}

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


const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_CONFLICT = 409;
const TO_NS = 1000 * 1000 * 1000;
const property = PropertiesService.getUserProperties();

/**
 * 起動関数。
 * 
 * HealthPlanet及びGoogleFitとの認証を行う必要があるため初回は手動で実行し
 * 下記の手順に従って認証を完了させる。認証完了後はトリガー起動での定期的な実行が可能。
 * 1. 起動すると実行ログにHealthPlanet認証用URLが出力されるので、ブラウザでアクセスする
 * 2. HealthPlanetのログイン画面が表示されるのでログインする
 * 3. HealthPlanetのアクセス許可画面が表示されるのでアクセスを許可する
 * 4. Google Driveの「現在、ファイルを開くことができません。」というエラー画面が表示される
 * 5. HealthPlanetがGASから引き渡したリダイレクトURLのパラメータ部分をカットしていることが
 *    エラーの原因なので、下記の通りSTATE部分を補う（実行ログからコピー）
 *    誤）https://script.google.com/macros/d/{SCRIPT ID}/usercallback?code={CODE}
 *    正）https://script.google.com/macros/d/{SCRIPT ID}/usercallback?code={CODE}&state={STATE}
 * 6. Success!と表示されれば登録が完了。HealthPlanetの連携アプリ一覧にツールが表示される
 * 7. 続いて実行ログにGoogleFit認証用URLが出力されるので、ブラウザでアクセスする
 * 8. 画面の指示に従って認証を完了させる
 * 
 * HealthPlanet及びGoogleFitとのデータ削除を含む接続解除手順は下記の通り。
 * 1. removeHealthDataを実行してGoogleFitからデータセットを削除する
 *    （dataNameのコメントアウトで削除対象を切り替える）
 * 2. removeGFDataSourceを実行してGoogleFitからデータソースを削除する
 *    （dataNameのコメントアウトで削除対象を切り替える）
 * 3. listGFDataSourceを実行してデータソースが残っていないことを確認する
 * 4. GoogleFitアプリにて、このプログラムからの接続を解除する
 * 5. HealthPlanetにて、このプログラムからの接続を解除する
 * 6. logoutFromServiceを実行して、GoogleFit及びHealthPlanetから切断する
 */
const run = () => {
  const hpService = getHPService();
  let healthData;

  // HealthPlanetへの認証が完了していない場合は認証用URLを出力して終了する
  if (hpService.hasAccess()) {
    console.log("HealthPlanet is ready");
    healthData = fetchHealthData(hpService);
  } else {
    console.log("Please access the URL below to complete your authentication with HealthPlanet");
    console.log(hpService.getAuthorizationUrl());
    console.log("If you get a Google Drive error, please add the following parameter to the URL to access it");
    console.log(/(&state=.*?)&/.exec(hpService.getAuthorizationUrl())[1]);
  }

  const gfService = getGFService();

  // GoogleFitへの認証が完了していない場合は認証用URLを出力して終了する
  if (gfService.hasAccess()) {
    console.log("GoogleFit is ready");
    createGFDataSource(gfService, googleFit.weight);
    createGFDataSource(gfService, googleFit.fat);
    postHealthData(gfService, googleFit.weight, healthData);
    postHealthData(gfService, googleFit.fat, healthData);
  } else {
    console.log("Please go to the URL below to complete the authentication with GoogleFit");
    console.log(gfService.getAuthorizationUrl());
  }

  const fbService = getFBService();

  // Fitbitへの認証が完了していない場合は認証用URLを出力して終了する
  if (fbService.hasAccess()) {
    console.log("Fitbit is ready");
  } else {
    console.log("Please go to the URL below to complete the authentication with Fitbit");
    console.log(fbService.getAuthorizationUrl());
  }

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

/**
 * GoogleFit用の認証サービスを取得する。
 */
const getGFService = () => {
  return OAuth2.createService(googleFit.serviceName)
    .setAuthorizationBaseUrl(googleFit.setAuthorizationBaseUrl)
    .setTokenUrl(googleFit.tokenUrl)
    .setClientId(googleFit.clientId)
    .setClientSecret(googleFit.clientSecret)
    .setCallbackFunction(googleFit.callback)
    .setPropertyStore(property)
    .setScope(googleFit.scope)
    .setParam("login_hint", Session.getActiveUser().getEmail())
    .setParam("access_type", "offline")
    .setParam("approval_prompt", "force");
}

/**
 * GoogleFitのOAuth認証が完了したときに呼ばれるコールバック関数。
 */
const gfAuthCallback = (request) => {
  const gfService = getGFService();
  const isAuthorized = gfService.handleCallback(request);
  if (isAuthorized) {
    return HtmlService.createHtmlOutput("Success!");
  } else {
    return HtmlService.createHtmlOutput("Denied.");
  }
}

/**
 * GoogleFitにデータソースを作成する。
 */
const createGFDataSource = (service, dataName) => {
  const payload = {
    "dataStreamName": "TanitaScales",
    "type": "raw",
    "application": {
      "detailsUrl": "http://example.com",
      "name": "GoogleFit Transmitter",
      "version": "1"
    },
    "dataType": {
      "field": [
        {
          "name": dataName === googleFit.weight ? "weight" : "percentage",
          "format": "floatPoint"
        }
      ],
      "name": dataName
    },
    "device": {
      "manufacturer": "TANITA",
      "model": "RD-800",
      "type": "scale",
      "uid": "1000001",
      "version": "1.0"
    }
  };

  const options = {
    "headers": {
      "Authorization": "Bearer " + service.getAccessToken()
    },
    "muteHttpExceptions": true,
    "method": "POST",
    "contentType": "application/json",
    "payload": JSON.stringify(payload, null, 2)
  };

  const response = UrlFetchApp.fetch(googleFit.dataSourceUrl, options);

  if (response.getResponseCode() === HTTP_STATUS_CODE_CONFLICT) {
    console.log("GoogleFit data source %s is ready", dataName);
  } else if (response.getResponseCode() === HTTP_STATUS_CODE_OK) {
    const json = JSON.parse(response);
    if (!property.getProperty(dataName)) {
      property.setProperty(dataName, json.dataStreamId);
    }
    console.log("GoogleFit data source %s has been created successfully", dataName);
  } else {
    console.log("Failed to create GoogleFit data source %s", dataName);
    console.log(response.getResponseCode());
    console.log(response.getContentText());
  }
}

/**
 * GoogleFitへヘルスデータ（体重・体脂肪率）を登録する。
 */
const postHealthData = (service, dataName, healthData) => {

  // 登録するデータセットの最小時刻と最大時刻を算出する
  const minTime = Math.min.apply(null, healthData.data.map((elem) => { return elem.date; })).toString();
  const maxTime = Math.max.apply(null, healthData.data.map((elem) => { return elem.date; })).toString();
  const minTimeNs = convertUnixStartTime(minTime);
  const maxTimeNs = convertUnixEndTime(maxTime);

  payload = {
    minStartTimeNs: minTimeNs,
    maxEndTimeNs: maxTimeNs,
    dataSourceId: property.getProperty(dataName),
    point: []
  };

  healthData.data.map((elem) => {
    if ((dataName === googleFit.weight ? BODY_WEIGHT : BODY_FAT) === elem.tag) {
      payload.point.push({
        startTimeNanos: convertUnixStartTime(elem.date),
        endTimeNanos: convertUnixEndTime(elem.date),
        dataTypeName: dataName,
        value: [{ fpVal: elem.keydata }]
      });
    }
  });

  const options = {
    "headers": {
      "Authorization": "Bearer " + service.getAccessToken()
    },
    "muteHttpExceptions": true,
    "method": "PATCH",
    "contentType": "application/json",
    "payload": JSON.stringify(payload, null, 2)
  };

  const response = UrlFetchApp.fetch(
    Utilities.formatString(
      "%s/%s/datasets/%s",
      googleFit.dataSourceUrl,
      property.getProperty(dataName),
      `${minTimeNs}-${maxTimeNs}`
    ),
    options
  );

  if (response.getResponseCode = HTTP_STATUS_CODE_OK) {
    console.log("GoogleFit datasets %s have been registered successfully", dataName);
    console.log(response.getContentText());
  } else {
    console.log("Failed to register GoogleFit datasets %s", dataName);
    console.log(response.getResponseCode());
    console.log(response.getContentText());
  }
}

/**
 * 指定した日付（文字列）の開始時刻をナノ秒精度のUNIX時間に変換する。
 */
const convertUnixStartTime = (dateString) => {
  return dayjs.dayjs(dateString, "YYYYMMDDHHmm").startOf("date").unix() * TO_NS;
}

/**
 * 指定した日付（文字列）の終了時刻をナノ精度のUNIX時間に変換する。
 */
const convertUnixEndTime = (dateString) => {
  return dayjs.dayjs(dateString, "YYYYMMDDHHmm").endOf("date").unix() * TO_NS;
}

/**
 * GoogleFitのデータソースを列挙する（開発時用、単独で実行する）。
 */
const listGFDataSource = () => {
  const gfService = getGFService();
  const options = {
    "headers": {
      "Authorization": "Bearer " + gfService.getAccessToken()
    },
    "muteHttpExceptions": true,
    "method": "GET"
  };
  const response = UrlFetchApp.fetch(googleFit.dataSourceUrl, options);
  console.log(response.getResponseCode());
  console.log(response.getContentText());
}

/**
 * GoogleFitのデータソースを削除する（開発時用、単独で実行する）。
 * データを削除するには事前に全てのヘルスデータが削除されている必要がある。
 */
const removeGFDataSource = () => {

  // 処理したいデータに合わせてコメントアウトを入れ替える
  const dataName = googleFit.weight;
  // const dataName = googleFit.fat;

  const gfService = getGFService();
  const options = {
    "headers": {
      "Authorization": "Bearer " + gfService.getAccessToken()
    },
    "muteHttpExceptions": true,
    "method": "DELETE"
  };
  const response = UrlFetchApp.fetch(
    Utilities.formatString(
      "%s/%s",
      googleFit.dataSourceUrl,
      property.getProperty(dataName)
    ),
    options
  );
  console.log(response.getResponseCode());
  console.log(response.getContentText());
}

/**
 * GoogleFitからヘルスデータを削除する（開発時用、単独で実行する）。
 */
const removeHealthData = () => {

  // 処理したいデータに合わせてコメントアウトを入れ替える
  const dataName = googleFit.weight;
  // const dataName = googleFit.fat;

  const gfService = getGFService();
  const listOptions = {
    "headers": {
      "Authorization": "Bearer " + gfService.getAccessToken()
    },
    "muteHttpExceptions": true,
    "method": "GET"
  };
  const listResponse = UrlFetchApp.fetch(
    Utilities.formatString(
      "%s/%s/dataPointChanges",
      googleFit.dataSourceUrl,
      property.getProperty(dataName),
    ),
    listOptions
  );
  console.log(listResponse.getResponseCode());
  console.log(listResponse.getContentText());

  const json = JSON.parse(listResponse);

  // 登録されたデータセットの最小時刻と最大時刻を算出する
  const minTime = Math.min.apply(null, json.insertedDataPoint.map((elem) => { return elem.startTimeNanos; })).toString();
  const maxTime = Math.max.apply(null, json.insertedDataPoint.map((elem) => { return elem.endTimeNanos; })).toString();

  const deleteOptions = {
    "headers": {
      "Authorization": "Bearer " + gfService.getAccessToken()
    },
    "muteHttpExceptions": true,
    "method": "DELETE"
  };
  const deleteResponse = UrlFetchApp.fetch(
    Utilities.formatString(
      "%s/%s/datasets/%s",
      googleFit.dataSourceUrl,
      property.getProperty(dataName),
      `${minTime}-${maxTime}`
    ),
    deleteOptions
  );
  console.log(listResponse.getResponseCode());
  console.log(listResponse.getContentText());
}

/**
 * プロパティにGoogleFitのデータソース名をセットする（開発時用、単独で実行する）。
 * listGFDataSourceで取得したデータソース名をsetProperty第２引数に指定する。
 * 各サービスのサイトで接続を解除した後に実行する。
 */
const setDataourceToProperty = () => {
  console.log(property.getProperty(googleFit.weight));
  console.log(property.getProperty(googleFit.fat));
  property.setProperty(googleFit.weight, "< dataStreamId >");
  property.setProperty(googleFit.fat, "< dataStreamId >");
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

/**
 * HealthPlanetとGoogleFitとのOAuth認証を解除する（開発時用、単独で実行する）。
 * 各サービスのサイトで接続を解除した後に実行する。
 */
const logoutFromService = () => {
  getHPService().reset();
  getGFService().reset();
  property.deleteAllProperties();
  console.log("Logged out successfully")
}
