// Settings for the whole site (the same for everyone who uses it).
// Each person's own details live in the Profile tab of their tracker, which the
// setup wizard creates in their Google Drive the first time they sign in.
window.JD_CONFIG = {
  // OAuth client ID from Google Cloud (ends with .apps.googleusercontent.com).
  // Not a secret: Google only accepts it from the website addresses you list in Google Cloud.
  GOOGLE_CLIENT_ID: "840617445937-r7e6ed2m9jomvo8tdshg47i2inbug3nh.apps.googleusercontent.com",

  // Browser API key with the Google Picker API enabled. Used only by "I already have a tracker",
  // which lets someone pick a tracker the site didn't create. Not a secret; restrict it to your site address.
  GOOGLE_API_KEY: "",

  // Defaults for new users; each person can change theirs in their Profile tab.
  DAILY_LIMIT: 10,
  INMAIL_DAILY_LIMIT: 5,

  AUTO_REFRESH_MINUTES: 5,
};
