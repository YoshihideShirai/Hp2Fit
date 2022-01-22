
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
 * 8. 続いて実行ログにFitbit認証用URLが出力されるので、ブラウザでアクセスする
 * 9. 画面の指示に従って認証を完了させる
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
    fbPostHealthData(fbService,healthData);
  } else {
    console.log("Please go to the URL below to complete the authentication with Fitbit");
    console.log(fbService.getAuthorizationUrl());
  }
}

/**
 * HealthPlanetとGoogleFitとのOAuth認証を解除する（開発時用、単独で実行する）。
 * 各サービスのサイトで接続を解除した後に実行する。
 */
const logoutFromService = () => {
  getHPService().reset();
  getGFService().reset();
  getFBService().reset();
  property.deleteAllProperties();
  console.log("Logged out successfully")
}
