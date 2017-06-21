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
  kills: { val: Number, champion: String, summoner: String },
  deaths: { val: Number, champion: String, summoner: String },
  assists: { val: Number, champion: String, summoner: String },
  kda: { val: Number, champion: String, summoner: String },
  dpm: { val: Number, champion: String, summoner: String },
  totalDamageTaken: { val: Number, champion: String, summoner: String },
  totalDamageDealtToChampions: { val: Number, champion: String, summoner: String },
  longestTimeSpentLiving: { val: Number, champion: String, summoner: String },
  lowestDamageDealt: { val: Number, champion: String, summoner: String },
  lowestDPM: { val: Number, champion: String, summoner: String }
})
const Stat = mongoose.model('Stat', StatSchema)

const parsedGameSchema = new mongoose.Schema({
  summoner: String,
  gameId: [Number]
})
const ParsedGame = mongoose.model('ParsedGame', parsedGameSchema);

// Need to chain 3 async calls, each call requires the result of the previous async call, therefore need to chain promises
// order of async call: accountId -> matchHistory -> matchStats

// get accountId by summoner name
function accountId(sumName) {
  return new Promise((resolve, reject) => {
    axios.get(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${sumName}?api_key=${riotKey}`).then((data) => {
      console.log('fetching accID');
      resolve(data.data.accountId);
    }).catch((err) => {
      console.log(`cannot find summoner name`);
    })
  })
}
// search past 20 matches of accountID and return array of gameIds that were ARAM mode
// store championId as a workaround to match stats of game to its respective summoners
function matchHistory(accountId, accountName) {
  return new Promise((resolve, reject) => {
    let aramGameId = [];
    axios.get(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${accountId}/recent?api_key=${riotKey}`).then((data) => {
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
        // check if documents exist, create one if it does not exist
      let queryPromise = ParsedGame.count({ summoner: accountName }, (err, count) => {
          // create new collection for new users
          if (count > 0) {
            console.log('DOC EXIST');
          } else {
            ParsedGame({
              summoner: accountName,
              gameId: []
            }).save()
          }
        }).exec()
        // update gameId with parsedIds to avoid reading the same match history twice
      queryPromise.then(() => {
        ParsedGame.findOne({ summoner: accountName }, (err, res) => {
          // add new gameId to db
          let parsedId = res.gameId;
          aramGameId.forEach((game) => {
            // remove oldest parsed game, only need 20 since match history length is 20
            if (parsedId.length > 20) {
              parsedId.pop();
            }
            parsedId.includes(game.gameId) ? '' : parsedId.push(game.gameId)
          })
          console.log(res);
          res.save();
          resolve(aramGameId);
        })
      })
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

function matchStat(gameData) {
  return new Promise((resolve, reject) => {
    axios.get(`https://na1.api.riotgames.com/lol/match/v3/matches/${gameData.gameId}?api_key=${riotKey}`, matchStatConfig).then((data) => {
      console.log('fetching match data');
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
    }).catch((err) => {
      console.log(`error with fetching match stat ${err}`);
    })
  })
}
//
function getHighScore(gameId, accountName) {
  return new Promise((resolve, reject) => {
    Stat.find({}, { _id: 0, __v: 0 }, (err, stat) => {
      let currentStat = stat[0];
      let arr = [];
      for (let i = 0; i < 5; i++) {
        arr.push(matchStat(gameId[i]));
      }
      // gameId.forEach((game) => {
      //   arr.push(matchStat(game))
      // })
      // get matchStat for each gameId and updates current stats with any new highscores
      Promise.all(arr).then((res) => {
        console.log(res);
        let newStat;
        // iterate array of stat collection
        res.forEach((stat) => {
            // iterate through each stat we're tracking, and find the highest for each
            for (let props in stat) {
              // get lowest dpm
              if (props !== 'championId' && props === 'dpm' && stat[props] < currentStat.lowestDPM.val) {
                currentStat.lowestDPM.val = stat[props]
                currentStat.lowestDPM.champion = stat.championId
                currentStat.lowestDPM.summoner = accountName
              }
              // get lowest dmg dealt to champs
              if (props !== 'championId' && props === 'totalDamageDealtToChampions' && stat[props] < currentStat.lowestDamageDealt.val) {
                currentStat.lowestDamageDealt.val = stat[props]
                currentStat.lowestDamageDealt.champion = stat.championId
                currentStat.lowestDamageDealt.summoner = accountName
              }
              if (props !== 'championId' && stat[props] > currentStat[props].val) {
                // update val, champion, and summoner of new highest score
                currentStat[props].val = stat[props]
                currentStat[props].champion = stat.championId
                currentStat[props].summoner = accountName
              }
            }
            newStat = currentStat
          })
          // console.log(`new currentStat is ${newStat}`);
        resolve(newStat);
      }).catch((err) => {
        console.log(`err in getting highscore ${err}`);
      })
    })
  })
}

function convertChampionId(stat) {
  // need error handling for when id is already converted
  console.log('converting champ id');
  stat = stat.toJSON(); // weird bug with mongoose objs, would otherwise output $__, isNew, and errors, as props
  function updateToName(props, id) {
    return axios.get(`https://na1.api.riotgames.com/lol/static-data/v3/champions/${id}?locale=en_US&api_key=${riotKey}`).then((data) => {
      stat[props].champion = data.data.name;
      return stat;
    }).catch((err) => {
      console.log(`err code ${err}`);
      return stat // wont need this err handling when I add arr of gameid that are parsed already
    })
  }
  return new Promise((resolve, reject) => {
    let promiseArr = [];
    for (props in stat) {
      promiseArr.push(updateToName(props, stat[props].champion))
    }
    Promise.all(promiseArr).then((updatedStat) => {
      // console.log(updatedStat);
      resolve(updatedStat[0]); // each promise in the array is passed its result to .then, possible cleanup to code, but works as is
    })
  })
}

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
        let msg = ``;
        stat = stat[0].toJSON();
        // change stat names to make it more readable
        function changeStatNames(prop) {
          switch (prop) {
            case 'lowestDPM':
              return 'Lowest DPM';
              break;
            case 'lowestDamageDealt':
              return 'Lowest Damage Dealt';
              break;
            case 'longestTimeSpentLiving':
              return 'Longest Time Alive';
              break;
            case 'totalDamageDealtToChampions':
              return 'Highest Damage Dealt To Champions';
              break;
            case 'totalDamageTaken':
              return 'Highest Damage Taken';
              break;
            case 'dpm':
              return 'Highest DPM';
              break;
            case 'kda':
              return 'Highest KDA';
              break;
            case 'assists':
              return 'Most Assists';
              break;
            case 'deaths':
              return 'Most Deaths';
              break;
            case 'kills':
              return 'Most Kills';
              break;
            default:
              return prop;
              break;
          }
        }
        // create message for each stat
        for (props in stat) {
          msg += `\n **${changeStatNames(props)}**: __${stat[props].val}__ as __${stat[props].champion}__ by __${stat[props].summoner}__\n`;
        }
        message.reply(msg); // send message to client
      })
  }
});

client.login(discordToken); // register bot

mongoose.connect("mongodb://lol:lol@ds127842.mlab.com:27842/lol-bot")
const db = mongoose.connection;
db.once('open', () => {
  // test
  // db.collections.stats.drop();
  // Stat({
  //   kills: { val: 0, champion: '', summoner: '' },
  //   deaths: { val: 0, champion: '', summoner: '' },
  //   assists: { val: 0, champion: '', summoner: '' },
  //   kda: { val: 0, champion: '', summoner: '' },
  //   dpm: { val: 0, champion: '', summoner: '' },
  //   totalDamageTaken: { val: 0, champion: '', summoner: '' },
  //   totalDamageDealtToChampions: { val: 0, champion: '', summoner: '' },
  //   longestTimeSpentLiving: { val: 0, champion: '', summoner: '' },
  //   lowestDamageDealt: { val: 100000, champion: '', summoner: '' },
  //   lowestDPM: { val: 100000, champion: '', summoner: '' }
  // }).save()
  // db.collections.parsedgames.drop();
  // ParsedGame({
  //   summoner:'WthIsASummoner',
  //   gameId:[12345,5678]
  // }).save()
  server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
});


//---------------------- M A I N ----------------------------------// 
function main(accountName) {
  return new Promise((resolve, reject) => {
    accountId(accountName).then((res) => {
      matchHistory(res, accountName).then((res, err) => {
        // need to do this so we can pass in accountName to getHighScore
        getHighScore(res, accountName).then(convertChampionId).then((result) => {
          //save result to db
          resolve(result);
          Stat.update({}, result, (err, data) => {
            if (err) {
              console.log('pooped');
            } else {
              console.log('saving to db');
            }
          })
        })
      })
    })
  })
}
Promise.all([main('koreanism')]).then((res) => {
  // compare final highscore of each summoner to find the overall highscore (todo when api key approved)
  console.log(res);
})
