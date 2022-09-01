// require spotify-web-api-node package
const SpotifyWebApi = require("spotify-web-api-node");

// setting the spotify-api
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});

// retrieve an access token for spotify-api
spotifyApi
  .clientCredentialsGrant()
  .then((data) => {
    console.log("Token expires: ", data.body["expires_in"]);
    spotifyApi.setAccessToken(data.body["access_token"]);
  })
  .catch((err) =>
    console.log("Something went wrong when retrieving an access token", err)
  );

module.exports = spotifyApi;
