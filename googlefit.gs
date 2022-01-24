
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
      "model": SCALE_MODEL,
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
  return dayjs.dayjs(dateString, "YYYYMMDDHHmm").unix() * TO_NS;
}

/**
 * 指定した日付（文字列）の終了時刻をナノ精度のUNIX時間に変換する。
 */
const convertUnixEndTime = (dateString) => {
  return dayjs.dayjs(dateString, "YYYYMMDDHHmm").unix() * TO_NS;
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
