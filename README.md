# HealthPlanet → Google fit/Fitbit 連携ツール

## 概要

HealthPlanetの体重と体脂肪率を、Google fit/Fitbitに転送するツール。  
Google Apps Script(以下 GAS)を使用しているが、GASにはスケジュール機能があるため、  
自動で連動される。

## 動作環境

- Google Apps Script (googleアカウントがあれば、無料で利用できる。)

## ソースコードをGoogle Apps Scriptへの取り込み

1. Githubアカウントを持ってなければ作成。
1. Githubで、このリポジトリをForkする。
1. Google Apps Script GitHub アシスタント(以下、GASアシスタント)をインストール & setup
https://chrome.google.com/webstore/detail/google-apps-script-github/lfjcgcmkmjjlieihflfhjopckgpelofo
https://tonari-it.com/gas-github-assistant-install/
1. Apps Scriptのプロジェクトを作成する。プロジェクト名はお好みで。
https://script.google.com/home
1. ForkしたGithubリポジトリが、 GASアシスタントから見えるようになるので、そのリポジトリで mainブランチを指定して 【↓】アイコンのpullを実行する。
1. 本リポジトリにある props.gs.template を、Apps Scriptのプロジェクトに props.gsとしてコピーペースト実施。

## ツールのセットアップ

1. 各種APIに対応するクライアントキーやシークレットを作成し、props.gsに記載する。
1. props.gs内のsetProps()を実行する。
1. main.gs内のrun()を実行する。
1. 起動すると実行ログにHealthPlanet認証用URLが出力されるので、ブラウザでアクセスする
1. HealthPlanetのログイン画面が表示されるのでログインする
1. HealthPlanetのアクセス許可画面が表示されるのでアクセスを許可する
1. Google Driveの「現在、ファイルを開くことができません。」というエラー画面が表示される
1. HealthPlanetがGASから引き渡したリダイレクトURLのパラメータ部分をカットしていることが  
エラーの原因なので、下記の通りSTATE部分を補う（実行ログからコピー）  
誤）https://script.google.com/macros/d/{SCRIPT ID}/usercallback?code={CODE}  
正）https://script.google.com/macros/d/{SCRIPT ID}/usercallback?code={CODE}&state={STATE}
1. Success!と表示されれば登録が完了。HealthPlanetの連携アプリ一覧にツールが表示される
1. 続いて実行ログにGoogleFit認証用URLが出力されるので、ブラウザでアクセスする
1. 続いて実行ログにFitbit認証用URLが出力されるので、ブラウザでアクセスする
1. 画面の指示に従って認証を完了させる
1. main.gs内のrun()を実行する。これで、データが送信できていれば、OK。

## 定期実行

1. Apps Scriptプロジェクトに、トリガー設定がある。 main.gs内のrun() を 1時間毎などに設定する。

お疲れ様でした！！！

## 参考(というかほぼそのまま)

https://qiita.com/potstickers/items/8fa8dce3e31efcde078a  
https://qiita.com/hirotow/items/d7a6384ff85437d94b0a  
