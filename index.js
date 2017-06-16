const Discord = require('discord.js');
const axios = require('axios');
const express = require('express');
const app = express();
const client = new Discord.Client();
const channel = new Discord.Channel();
const discordToken = 'MzIzOTAxOTIxNDQ0MjMzMjI3.DCB60A.Lzs3RPxL3-CIQXIOtB7GItMtMYc';
const riotKey = '313e9daa-ebc1-4446-959f-743688e91837';
var server = require('http').Server(app);
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const PORT = process.env.PORT || 3000; // req process.env.port for heroku, 3000 on local

//---- DATABASE --- //
//************************************** Schemas
const Schema = mongoose.Schema;

const StatSchema = new mongoose.Schema({
  kills: String,
  deaths: String,
  assists: String,
  kda: String,
  totalDamageTaken: String,
  totalDamageDealtToChampions: String,
  longestTimeSpentLiving: String,
  championId: String,
})

const Stat = mongoose.model('Stat', StatSchema)


// Need to chain 3 async calls, each call requires the result of the previous async call, therefore need to chain promises
// order of async call: accountId -> matchHistory -> matchStats

// get accountId by summoner name
function accountId(sumName) {
  return new Promise((resolve, reject) => {
    return axios.get(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${sumName}?api_key=${riotKey}`).then((data) => {
      console.log('fetching accID');
      resolve(data.data.accountId);
    })
  })
}
// search past 20 matches of accountID and return array of gameIds that were ARAM mode
// store championId as a workaround to match stats of game to its proper player 
function matchHistory(accountId) {
  return new Promise((resolve, reject) => {
    let aramGameId = [];
    return axios.get(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${accountId}/recent?api_key=${riotKey}`).then((data) => {
      console.log('fetching match history');
      let games = data.data.matches;
      games.map((game) => {
          // ARAM has queue number of 65
          if (game.queue === 65) {
            aramGameId.push({ gameId: game.gameId, championId: game.champion })
          } else {
            return game
          }
        })
        // console.log(aramGameId);
      resolve(aramGameId);
    })
  })
}
// get stats of each aram game
// relevant stats: totalDamageDealtToChampions, deaths, longestTimeSpentLiving, kills, assists, totalDamageTaken, championId
const matchStatConfig = {
  "headers": {
    "Origin": "https://developer.riotgames.com",
    "Accept-Charset": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Riot-Token": "313e9daa-ebc1-4446-959f-743688e91837",
    "Accept-Language": "en-US,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
  }
}

let matchStat = function(gameData) {
    return new Promise((resolve, reject) => {
      return axios.get(`https://na1.api.riotgames.com/lol/match/v3/matches/${gameData.gameId}?api_key=${riotKey}`, matchStatConfig).then((data) => {
        // find participant by matching championId
        console.log(gameData);
        let matchedData = data.data.participants.find((participant) => {
            return participant.championId == gameData.championId;
          })
          // get relevant stats
        let { kills, assists, deaths, totalDamageDealtToChampions, totalDamageTaken, longestTimeSpentLiving } = matchedData.stats;
        let gameDuration = data.data.gameDuration;
        // calculate damage per minute
        let dpm = (function calcDPM(damage, seconds) {
          let minutes = seconds / 60;
          let dpm = damage / minutes;
          // round to 2 digits
          return dpm.toFixed(2);
        })(totalDamageDealtToChampions, gameDuration);
        // calculate KDA
        let kda = ((kills + assists) / deaths).toFixed(2);
        // stats passed for promise.all
        resolve({ kills, assists, deaths, kda, totalDamageDealtToChampions, totalDamageTaken, longestTimeSpentLiving, dpm, championId: gameData.championId });
      })
    })
  }
  // matchStat({ gameId: '2523061524', championId: '238' });


//************************************** 
// DISCORD JS // 

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {
  if (message.content === 'ping') {
    message.reply('pong');
  }
  switch (message.content) {
    case '!stats':
      // get all collections, excludes _id and __v
      Stat.find({}, { _id: 0, __v: 0 }, (err, stat) => {
        message.reply(stat);
      })
  }
});

client.login(discordToken);

mongoose.connect("mongodb://lol:lol@ds127842.mlab.com:27842/lol-bot")
const db = mongoose.connection;
db.once('open', () => {
  // test
  // db.collections.stats.drop();
  // Stat({
  //   kills: '0',
  //   deaths: '0',
  //   assists: '0',
  //   kda: '0',
  //   dpm:'0',
  //   totalDamageTaken: '0',
  //   totalDamageDealtToChampions: '0',
  //   longestTimeSpentLiving: '0',
  //   championId: '0',
  // }).save()
  server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
});
//---------------------- M A I N ----------------------------------// 

// get current stats from db to compare with new stats
(function main(accountName) {
  Stat.find({}, { _id: 0, __v: 0 }, (err, stat) => {
    let currentStat = stat[0];
    console.log(currentStat);
    // fetch new stats from api
    accountId(accountName).then(matchHistory).then((res) => {
      let arr = []; // stores gameData (gameid and champid) to be resolved as promises
      /* works in production when rate limit not an issue
      res.forEach((gameData) => {
        arr.push(matchStat(gameData))
      })
      */
      // for dev only, limit testing to 5 match stats!!!
      for (let i = 0; i < 5; i++) {
        arr.push(matchStat(res[i]));
      }
      // 
      // fetch matchStat for each gameId
      Promise.all(arr).then((res) => {
        console.log(res);
        let newStat;
        // iterate array of stat collection
        res.forEach((stat) => {
            // iterate through each stat we're tracking, and find the highest for each
            for (props in stat) {
              console.log(`comparing ${stat[props]} and ${currentStat[props]}`);
              if (stat[props] > currentStat[props]) {
                currentStat[props] = stat[props]
              }
            }
            newStat = currentStat
          })
          // console.log(`new currentStat is ${newStat}`);
        return newStat;
      }).then((newStat) => {
        // save new stat highscore to db
        console.log(newStat, accountName);
      })
    })
  })
})('WthIsASummoner')
