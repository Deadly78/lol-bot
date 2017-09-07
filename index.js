// // tooo
// // - sort stats by champion role (ex: most kills for support , adc, etc..)
require('dotenv').config()
const Discord = require('discord.js');
const axios = require('axios');
const express = require('express');
const app = express();
const client = new Discord.Client();
const channel = new Discord.Channel();
const discordToken = process.env.discordToken;
const riotKey = process.env.riotKey;
var server = require('http').Server(app);
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const PORT = process.env.PORT || 3000; // req process.env.port for heroku, 3000 on local
let championsId = { "id": { "1": "Annie", "2": "Olaf", "3": "Galio", "4": "TwistedFate", "5": "XinZhao", "6": "Urgot", "7": "Leblanc", "8": "Vladimir", "9": "FiddleSticks", "10": "Kayle", "11": "MasterYi", "12": "Alistar", "13": "Ryze", "14": "Sion", "15": "Sivir", "16": "Soraka", "17": "Teemo", "18": "Tristana", "19": "Warwick", "20": "Nunu", "21": "MissFortune", "22": "Ashe", "23": "Tryndamere", "24": "Jax", "25": "Morgana", "26": "Zilean", "27": "Singed", "28": "Evelynn", "29": "Twitch", "30": "Karthus", "31": "Chogath", "32": "Amumu", "33": "Rammus", "34": "Anivia", "35": "Shaco", "36": "DrMundo", "37": "Sona", "38": "Kassadin", "39": "Irelia", "40": "Janna", "41": "Gangplank", "42": "Corki", "43": "Karma", "44": "Taric", "45": "Veigar", "48": "Trundle", "50": "Swain", "51": "Caitlyn", "53": "Blitzcrank", "54": "Malphite", "55": "Katarina", "56": "Nocturne", "57": "Maokai", "58": "Renekton", "59": "JarvanIV", "60": "Elise", "61": "Orianna", "62": "MonkeyKing", "63": "Brand", "64": "LeeSin", "67": "Vayne", "68": "Rumble", "69": "Cassiopeia", "72": "Skarner", "74": "Heimerdinger", "75": "Nasus", "76": "Nidalee", "77": "Udyr", "78": "Poppy", "79": "Gragas", "80": "Pantheon", "81": "Ezreal", "82": "Mordekaiser", "83": "Yorick", "84": "Akali", "85": "Kennen", "86": "Garen", "89": "Leona", "90": "Malzahar", "91": "Talon", "92": "Riven", "96": "KogMaw", "98": "Shen", "99": "Lux", "101": "Xerath", "102": "Shyvana", "103": "Ahri", "104": "Graves", "105": "Fizz", "106": "Volibear", "107": "Rengar", "110": "Varus", "111": "Nautilus", "112": "Viktor", "113": "Sejuani", "114": "Fiora", "115": "Ziggs", "117": "Lulu", "119": "Draven", "120": "Hecarim", "121": "Khazix", "122": "Darius", "126": "Jayce", "127": "Lissandra", "131": "Diana", "133": "Quinn", "134": "Syndra", "136": "AurelionSol", "141": "Kayn", "143": "Zyra", "150": "Gnar", "154": "Zac", "157": "Yasuo", "161": "Velkoz", "163": "Taliyah", "164": "Camille", "201": "Braum", "202": "Jhin", "203": "Kindred", "222": "Jinx", "223": "TahmKench", "236": "Lucian", "238": "Zed", "240": "Kled", "245": "Ekko", "254": "Vi", "266": "Aatrox", "267": "Nami", "268": "Azir", "412": "Thresh", "420": "Illaoi", "421": "RekSai", "427": "Ivern", "429": "Kalista", "432": "Bard", "497": "Rakan", "498": "Xayah", "516": "Ornn" } }
client.login(discordToken); // register bot

////////////////////////////
// List of Users to Track //
////////////////////////////
let users = ['WthIsASummoner', 'Disturbcircles', 'Gamerxz', 'Koreanism', 'Best bitter', 'SunK', 'HoN is the best', 'lmnop1', 'Unforgottens', 'Omegabae'];
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

// Need to chain 3 async calls in order to get ARAM match stats from a Summoner's name, each call requires the result of the previous async call, therefore need to chain promises
// order of async call: accountId -> matchHistory -> matchStats

/**
 * Get account id from Summoner name
 * @param  {String} sumName [summoner name]
 * @return {String}         [id of summoner name]
 */
function accountId(sumName) {
  return new Promise((resolve, reject) => {
    axios.get(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${sumName}?api_key=${riotKey}`).then((data) => {
      resolve(data.data.accountId);
    }).catch((err) => {
      console.log(`cannot find summoner name`);
    })
  })
}

/**
 * Get match id of all ARAM games
 * @param  {String} accountId   [id from Summoner's name]
 * @param  {String} accountName [Summoner name]
 * @return {Array}              [match id of all ARAM games]
 */

function matchHistory(accountId, accountName) {
  return new Promise((resolve, reject) => {
    let aramGameId = [];
    let parsedGameArr;
    console.log(accountName);

    // ----- Create new parsed collection if it does not exist, otherwise, get collection of parsed game ids ----- //
    ParsedGame.count({ summoner: accountName }, (err, count) => {
      // create new collection for new users
      if (count > 0) {
        console.log('pasred document for user exists');
        ParsedGame.findOne({ summoner: accountName }, { _id: 0, __v: 0 }, (err, stat) => {
          parsedGameArr = stat.gameId;
        });
      } else {
        console.log('creating new parsed game document');
        parsedGameArr = [];
        ParsedGame({
          summoner: accountName,
          gameId: []
        }).save()
      }
    })

    // ----- Get all *UNPARSED* ARAM games' id from match history ----- //
    axios.get(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${accountId}/recent?api_key=${riotKey}`).then((data) => {
      let games = data.data.matches;

      games.map((game) => {
        // ARAM has queue id of 65 and is not parsed 
        if (game.queue === 65 && parsedGameArr && !parsedGameArr.includes(game.gameId)) {
          console.log('adding new game ids');
          aramGameId.push({ gameId: game.gameId, championId: game.champion })
        } else {
          return game
        }
      })
      if (aramGameId.length < 1) {
        console.log('empty arr detected');

      }
      console.log(aramGameId);

      // ----- Create a new collection of parsed games if it does not exist already ----- //
      let queryPromise = ParsedGame.count({ summoner: accountName }, (err, count) => {
          // create new collection for new users
          if (count > 0) {
            // console.log('DOC EXIST');
          } else {
            ParsedGame({
              summoner: accountName,
              gameId: []
            }).save()
          }
        }).exec()
        // ----- Update parsed games collection with new ids from match history ----- //
      queryPromise.then(() => {
        ParsedGame.findOne({ summoner: accountName }, (err, res) => {
          // add new gameId to db
          let parsedId = res.gameId;
          aramGameId.forEach((game) => {
            // remove oldest parsed game, only need 20 since match history length is 20
            if (parsedId.length > 25) {
              parsedId.pop();
            }
            // add newly parsed game id to the parsedId array
            parsedId.includes(game.gameId) ? '' : parsedId.push(game.gameId)
          })
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
    "X-Riot-Token": riotKey,
    "Accept-Language": "en-US,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
  }
}

/**
 * Get stats category, such as k/d/a, from each match
 * @param  {[Array]} gameData [aram game ids ]
 * @return {[type]}          [description]
 */
function matchStat(gameData) {
  return new Promise((resolve, reject) => {
    axios.get(`https://na1.api.riotgames.com/lol/match/v3/matches/${gameData.gameId}?api_key=${riotKey}`, matchStatConfig).then((data) => {
      console.log('fetching match data');
      // find participant by matching championId to summoner's id
      // console.log(gameData);
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
      console.log('fetched match data');
      resolve({ kills, assists, deaths, kda, totalDamageDealtToChampions, totalDamageTaken, longestTimeSpentLiving, dpm, championId: gameData.championId });
    }).catch((err) => {
      console.log(`error with fetching match stat ${err}`);
    })
  })
}

/**
 * Compares stats of all ARAM match, and returns highest (or lowest) score of each cateogory  
 * @param  {[Object object]} gameId      [description]
 * @param  {String}          accountName [Summoner's name]
 * @return {Object object}               [Highscore of relevant stats, containing the summoner's name, value, and champion]
 */
function getHighScore(gameId, accountName) {
  console.log('fetching highscore');
  return new Promise((resolve, reject) => {
    Stat.find({}, { _id: 0, __v: 0 }, (err, stat) => {
      let currentStat = stat[0]; // stat stored in database
      let promiseArr = [];
      // for (let i = 0; i < 2; i++) {
      //   promiseArr.push(matchStat(gameId[i]));
      // }
      gameId.forEach((game) => {
          promiseArr.push(matchStat(game))
        })
        // get matchStat for each gameId and updates current stats with any new highscores
      Promise.all(promiseArr).then((res) => {
        // console.log(res);
        let newStat; // stats just retreived 
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
            // get highest number of all other stats
            if (props !== 'championId' && stat[props] > currentStat[props].val) {
              // update val, champion, and summoner of new highest score
              currentStat[props].val = stat[props]
              currentStat[props].champion = stat.championId
              currentStat[props].summoner = accountName
            }
          }
          newStat = currentStat
        })
        console.log('fetched highscore');
        // console.log(`new currentStat is ${newStat}`);
        resolve(newStat);
      }).catch((err) => {
        console.log(`err in getting highscore ${err}`);
      })
    })
  })
}

/**
 * Convert champion's id to its name
 * @param  {[Object object]} stat [collection of highscores]
 * @return {[Object object]}      [returns the collection of highscores, with the 'champion' property containing its name instead of id number]
 */
function convertChampionId(stat) {
  console.log('converting champion id to names ');
  // console.log(stat);
  if (stat) {
    stat = stat.toJSON();
  }
  for (key in stat) {
    if (championsId.id[stat[key].champion]) {
      stat[key].champion = championsId.id[stat[key].champion];
    }
  }
  console.log('converted champion id to names');
  // console.log(stat);
  return stat;
}

//************************************** 
// DISCORD JS // 

client.on('ready', () => {
  console.log('I am ready!');
});

client.on('message', message => {

  switch (message.content) {
    case '!stats':
      message.channel.send('Fetching stats ...');
      // sequentially run main() with the list of users in the array as paramter. highscore automatically updates itself with each run of main()
      users.reduce((p, name) => {
        return p.then(() => {
          return main(name);
        });
      }, Promise.resolve()).then(() => {
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
      })
      break;
    case '!users':
      message.reply(users);
      break;
  }
});


mongoose.connect("mongodb://lol:lol@ds127842.mlab.com:27842/lol-bot", (e) => {
  if (e) { console.log(e); }
})
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
      matchHistory(res, accountName).then((res, rej) => {
        // skip reset of functions if there are no new games to parse
        if (res.length > 0) {
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
        } else {
          resolve();
        }
      })
    })
  })
}
