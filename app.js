// BACKEND CODE
import express from 'express'
import fetch from 'node-fetch'
import http from 'http'
import tmi from 'tmi.js'
import { Server } from 'socket.io'
const app = express()
const server = http.createServer(app)
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })
import dotenv from 'dotenv'
dotenv.config()

const port = 3000

let games = {}
let effects = [
  // {
  //   name: 'PULSO',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  // {
  //   name: 'ECO',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  // {
  //   name: 'TURBO',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  {
    name: 'REDUCCION',
    votes: {},
    duration: 30 * 1000,
    addEffect: (gameId) => {
      if (games[gameId]) {
        games[gameId].ball.radius = ballData.radius / 2
        games[gameId].ballData.radius = ballData.radius / 2
      }
    },
    removeEffect: (gameId) => {
      if (games[gameId]) {
        games[gameId].ball.radius = ballData.radius
        games[gameId].ballData.radius = ballData.radius
      }
    }
  }
  // {
  //   name: 'CAOS',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  // {
  //   name: 'DISRUPCIÓN',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  // {
  //   name: 'MUTACIÓN',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  // {
  //   name: 'INERCIA',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // },
  // {
  //   name: 'GIRO',
  //   votes: {},
  //   duration: 30 * 1000,
  //   addEffect: (gameId) => {},
  //   removeEffect: (gameId) => {}
  // }
]
let timersIntervals = {}
let gameLoopsIntervals = {}
let effectsIntervals = {}
let area = {
  x: 400,
  y: 300,
  radius: 300
}
let playerData = {
  speed: 0.005,
  radius: 35
}
let ballData = {
  speed: 3,
  randomness: 0.01,
  speedToAdd: 0.03,
  radius: 10
}
let twitchClients = new Map()

app.use(express.static('public'))

app.get('/twitch/callback', async (req, res) => {
  let { code, state } = req.query
  if (!code) {
    return res.status(400).send('No code in query')
  }

  let game = games[state]

  if (game.twitch) {
    return res.send('Twitch is already connected for this game.')
  }

  const params = new URLSearchParams()
  params.append('client_id', process.env.TWITCH_CLIENT_ID)
  params.append('client_secret', process.env.TWITCH_CLIENT_SECRET)
  params.append('code', code)
  params.append('grant_type', 'authorization_code')
  params.append('redirect_uri', process.env.TWITCH_REDIRECT_URI)

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: params
    })

    const data = await response.json()

    const userResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    })

    const userData = await userResponse.json()
    const username = userData.data[0].login

    const client = new tmi.Client({
      options: { debug: true },
      identity: {
        username: process.env.TWITCH_USERNAME,
        password: `oauth:${data.access_token}`
      },
      channels: [username]
    })

    client.connect()

    client.on('message', (channel, tags, message, self) => {
      if (self) {
        return
      }
      let voteCommandRegex = /^!vote\s+(\w+)$/i
      let matchName = message.match(voteCommandRegex)
      let voteCommandRegexNumber = /^!vote\s+([1-3])$/i
      let matchNumber = message.match(voteCommandRegexNumber)
      let gameId = state
      let game = games[gameId]
      if (game && game.effects) {
        let voteName
        if (matchNumber) {
          const voteIndex = parseInt(matchNumber[1]) - 1
          voteName = Object.keys(game.effects)[voteIndex]
        } else if (matchName) {
          let effect = game.effects[matchName[1].toUpperCase()]
          if (effect) {
            voteName = effect.name
          }
        }
        if (voteName) {
          handleVoteEffects({
            game: gameId,
            choise: { name: voteName },
            id: tags['user-id']
          })
        }
      }
    })

    twitchClients.set(state, client)

    game.twitch = {
      channel: username
    }

    setTimeout(() => {
      handleExpire(state)
    }, 12_600_000)

    res.send('Authentication successful! You can close this tab.')
  } catch (err) {
    console.error(err)
    res.status(500).send('Error exchanging code for token')
  }
})

const generatePolygon = (numSides) => {
  const vertices = []
  const startAngle = -Math.PI / numSides
  for (let i = 0; i < numSides; i++) {
    const angle = startAngle + (2 * Math.PI * i) / numSides
    const x = area.x + area.radius * Math.cos(angle)
    const y = area.y + area.radius * Math.sin(angle)
    vertices.push({ x, y })
  }
  return vertices
}

const generateId = () => {
  return Math.random().toString().slice(2)
}

const generatePlayer = (data) => {
  return {
    name: data.name,
    radius: data.game.playerData.radius,
    color: data.color ? data.color : generateColor()
  }
}

const generateColor = () => {
  return `rgb(${[...Array(3)]
    .map(() => Math.floor(Math.random() * 256))
    .join(',')})`
}

io.on('connection', (socket) => {
  io.to(socket.id).emit('connected')
  socket.on('start', (data) => {
    let game = games[data.gameId]
    game.settings = data.settings
    let { players, playerCount } = game
    //? enodrac -
    // let auxPlayers = [...Array(1)]
    // auxPlayers.forEach((item, index) => {
    //   game.playerCount++
    //   let auxId = generateId()
    //   players[auxId] = {
    //     id: auxId,
    //     name: generateId(),
    //     radius: playerData.radius,
    //     color: generateColor()
    //     // leave: !index ? true : false
    //   }
    // })
    // game.players = players
    // playerCount = game.playerCount
    //? enodrac -
    let poligonSides = playerCount === 1 || playerCount === 2 ? 4 : playerCount
    let polygon = generatePolygon(poligonSides)
    game.area = area
    game.polygon = polygon
    resetPlayers(game)
    let ball = {
      radius: game.ballData.radius,
      bounces: 0
    }
    game.ball = ball
    ballAimRandomPlayer(game)
    let timerInterval = setInterval(() => {
      if (game.settings.time <= 0) {
        let maxScore = -Infinity
        let topPlayers = []
        for (let id in game.score) {
          let score = game.score[id]
          if (score > maxScore) {
            maxScore = score
            topPlayers = [id]
          } else if (score === maxScore) {
            topPlayers.push(id)
          }
        }
        if (game.settings.health) {
          game.tie = true
        } else if (topPlayers.length > 1) {
          game.settings.time = 0
          game.tie = true
        } else {
          game.winner = topPlayers[0]
          handleWinner(game)
        }
      }
      if (!game.countdownTimer) {
        game.settings.time = game.settings.time + (game.tie ? 1 : -1)
      }
    }, 1_000)
    timersIntervals[game.id] = timerInterval
    io.to(game.id).emit('start', game)
    let gameLoopInterval = setInterval(() => gameLoop(game.id), 1000 / 90)
    gameLoopsIntervals[game.id] = gameLoopInterval
    if (game.settings.effects) {
      let effectsInterval = setInterval(() => {
        setEffects(game)
      }, 60_000)
      setTimeout(() => {
        setEffects(game)
      }, 8_000)
      effectsIntervals[game.id] = effectsInterval
    }
    resetBall(game)
  })

  socket.on('join', (data) => {
    let game = games[data.id]
    if (game) {
      game.players[socket.id] = {
        ...generatePlayer({ ...data, game }),
        id: socket.id
      }
      game.playerCount++
      game.activePlayerCount++
      game.messages.push({
        id: socket.id,
        player: game.players[socket.id],
        message: 'Se unio a la sala',
        time: new Date()
      })
      socket.join(game.id)
      io.emit('lobies', games)
      io.to(game.id).emit('loby', game)
      io.to(socket.id).emit('create', game)
    }
  })

  socket.on('disconnect', () => {
    handleCancel({
      game: Object.values(games).find((game) => game.players[socket.id])?.id,
      player: socket.id
    })
  })

  socket.on('test', (data) => {
    for (let name in games[data.game].effects) {
      let effect = games[data.game].effects[name]
      for (let id in effect.votes) {
        delete effect.votes[id]
      }
    }
    io.to(data.game).emit('effects', games[data.game].effects)
  })

  socket.on('cancel', (data) => {
    socket.leave(data.game)
    handleCancel({ ...data, player: socket.id })
  })

  socket.on('messages', (data) => {
    games[data.id].messages.push({
      id: data.player,
      player: games[data.id].players[data.player],
      message: data.message,
      time: new Date()
    })
    io.to(data.id).emit('messages', games[data.id])
  })

  socket.on('create', (data) => {
    let gameId = generateId()
    let game = {
      id: gameId,
      owner: socket.id,
      playerData: JSON.parse(JSON.stringify(playerData)),
      ballData: JSON.parse(JSON.stringify(ballData)),
      name: `Sala de: ${data.name}`,
      score: {},
      playerCount: 1,
      activePlayerCount: 1,
      messages: []
    }
    game.players = {
      [socket.id]: {
        ...generatePlayer({ ...data, game }),
        id: socket.id
      }
    }
    games[gameId] = game
    socket.join(gameId)
    io.emit('lobies', games)
    io.to(gameId).emit('create', games[gameId])
  })

  socket.on('color', (data) => {
    games[data.id].players[data.player].color = data.color
    io.to(data.id).emit('loby', games[data.id])
  })

  socket.on('player', (data) => {
    if (!games[data.gameId]) {
      return
    }
    let player = games[data.gameId].players[socket.id]
    player.movement = data.movement
    // Update server-side player position based on movement
    updatePlayerPosition(games[data.gameId], socket.id, data.movement)

    // Send the *authoritative* player state back to the client
    io.to(data.gameId).emit('server_update', {
      timestamp: Date.now(),
      x: player.x,
      y: player.y,
      vx: player.vx, // Include velocity for smoother correction
      vy: player.vy,
      gameId: data.gameId
    })
  })

  socket.on('restart', (data) => {
    handleRestartGame(games[data.gameId])
  })

  socket.on('effects', (data) => {
    handleVoteEffects({ ...data, id: socket.id })
  })
})

const handleVoteEffects = (data) => {
  for (let name in games[data.game].effects) {
    let effect = games[data.game].effects[name]
    if (effect.votes[data.id]) {
      delete effect.votes[data.id]
    } else if (
      data.choise.name?.toString()?.toLowerCase() ===
      name?.toString()?.toLowerCase()
    ) {
      effect.votes[data.id] = true
    }
  }
  io.to(data.game).emit('effects', games[data.game].effects)
}

const setEffects = (game) => {
  const choises = getRandomEffects(3)
  game.effects = choises
  io.to(game.id).emit('effects', { choises })
  setTimeout(() => {
    let maxVotes = -Infinity
    let topEffects = []
    for (let name in game.effects) {
      let votes = Object.keys(game.effects[name].votes).length
      if (votes > maxVotes) {
        maxVotes = votes
        topEffects = [name]
      } else if (votes === maxVotes) {
        topEffects.push(name)
      }
    }
    let selected
    if (topEffects.length > 1) {
      selected = topEffects[Math.floor(Math.random() * topEffects.length)]
    } else {
      selected = topEffects[0]
    }
    let effect = game.effects[selected]
    if (effect) {
      effect.selected = true
      effect.addEffect(game.id)
      io.to(game.id).emit('effects', { effect })
      setTimeout(() => {
        effect.removeEffect(game.id)
        io.to(game.id).emit('effects')
      }, 30_000)
    }
  }, 10_000)
}

const getRandomEffects = (count) => {
  let availableAlterations = [...effects]
  let choises = {}
  while (
    Object.keys(choises).length < count &&
    availableAlterations.length > 0
  ) {
    let randomIndex = Math.floor(Math.random() * availableAlterations.length)
    let effect = availableAlterations.splice(randomIndex, 1)[0]
    choises[effect.name] = effect
  }
  return choises
}

const ballAimRandomPlayer = (data) => {
  let randomId = Object.keys(data.players)[
    Math.floor(Math.random() * Object.keys(data.players).length)
  ]
  let side = data.players[randomId].side
  data.ball.color = data.players[randomId].color
  let { a, b } = side
  let midpoint = {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  }
  data.ball.x = area.x
  data.ball.y = area.y
  let dx = midpoint.x - data.ball.x
  let dy = midpoint.y - data.ball.y
  let length = Math.sqrt(dx * dx + dy * dy)
  data.ball.vx =
    (dx / length) * (data.ballData.speed * (data.settings.ballSpeed / 5))
  data.ball.vy =
    (dy / length) * (data.ballData.speed * (data.settings.ballSpeed / 5))
}

const handleRestartGame = (data) => {
  let players = {}
  let playerCount = 0
  for (let id in data.players) {
    if (!data.players[id].leave) {
      players[id] = data.players[id]
      playerCount++
    }
  }
  games[data.id] = {
    id: data.id,
    players: players,
    settings: data.settings,
    owner: data.owner,
    name: data.name,
    playerCount: playerCount,
    activePlayerCount: playerCount,
    messages: data.messages,
    score: {}
  }
  io.to(data.id).emit('restart', games[data.id])
}

const handleCancel = (data) => {
  let game = games[data.game]
  if (game) {
    let player = game.players[data.player]
    io.to(data.player).emit('cancel')
    if (!game.polygon) {
      delete game.players[player.id]
      delete game.score[player.id]
      game.playerCount--
    } else {
      player.leave = true
    }
    game.activePlayerCount--
    if (game.owner === player.id) {
      const client = twitchClients.get(game.id)
      if (client) {
        client.disconnect()
        twitchClients.delete(game.id)
      }
    }
    if (!game.playerCount || !game.activePlayerCount) {
      clearInterval(timersIntervals[game.id])
      clearInterval(gameLoopsIntervals[game.id])
      clearInterval(effectsIntervals[game.id])
      delete games[game.id]
      io.emit('lobies', games)
      io.to(game.id).emit('cancel')
      return
    }
    game.messages.push({
      id: player.id,
      player,
      message: 'Abandono la sala',
      time: new Date()
    })
    if (game.owner === player.id) {
      let owner = Object.values(game.players)[0]
      game.owner = owner.id
      game.name = `Sala de: ${owner.name}`
    }
    if (game.playerCount === 1 || game.activePlayerCount === 1) {
      game.winner = Object.keys(game.players)[0]
      handleWinner(game)
    }
  }
}

const handleExpire = (gameId) => {
  const game = games[gameId]
  if (game) {
    // Disconnect Twitch client if exists
    const client = twitchClients.get(gameId)
    if (client) {
      client.disconnect()
      twitchClients.delete(gameId)
    }

    // Delete the game
    delete games[gameId]

    // Optionally notify players if you track sockets per game
    // io.to(gameId).emit('gameExpired')
  }
}

const normalize = (dx, dy) => {
  const length = Math.sqrt(dx * dx + dy * dy) || 0.01
  return { x: dx / length, y: dy / length }
}

const reflectVelocity = (vx, vy, nx, ny) => {
  const dot = vx * nx + vy * ny
  return {
    vx: vx - 2 * dot * nx,
    vy: vy - 2 * dot * ny
  }
}

const resetPlayers = (data) => {
  const playerIds = Object.keys(data.players)
  const totalSides = data.polygon.length
  const playerCount = playerIds.length

  for (let i = 0; i < playerCount; i++) {
    const id = playerIds[i]
    const sideIndex = Math.floor((i * totalSides) / playerCount)
    const a = data.polygon[sideIndex]
    const b = data.polygon[(sideIndex + 1) % totalSides]

    if (!data.score[id]) {
      data.score[id] = data.settings.health ? data.settings.health : 0
    }

    data.players[id].side = { a, b }
    data.players[id].goal = {
      startT: playerCount > 5 ? 0 : 0.15,
      endT: playerCount > 5 ? 1 : 0.85
    }
    data.players[id].t = 0.5
    data.players[id].x = a.x + (b.x - a.x) * 0.5
    data.players[id].y = a.y + (b.y - a.y) * 0.5
  }
}

const resetBall = (data) => {
  let game = games[data.id]
  if (game) {
    ballAimRandomPlayer(data)
    game.ball.bounces = 0
    game.countdownTimer = 3
    io.to(game.id).emit('countdownTimer', game.countdownTimer)
    let countdownInterval = setInterval(() => {
      game.countdownTimer--
      io.to(game.id).emit('countdownTimer', game.countdownTimer)
      if (game.countdownTimer === 0) {
        clearInterval(countdownInterval)
      }
    }, 1000)
  }
}

const bounceAnimation = (data) => {
  if (data.player) {
    data.player.bounceRemaining = 2
    data.player.bounceExpansion = 2.5
    data.player.bounceReduction = 0.2
  }
  if (data.ball) {
    data.ball.bounceRemaining = 2
    data.ball.bounceExpansion = 2.5
    data.ball.bounceReduction = 0.2
    if (data.player) {
      data.ball.color = data.player.color
      data.ball.player = data.player.id
    }
  }
}

const handleGoal = (data) => {
  if (data.settings.health) {
    data.score[data.player] -= data.tie
      ? data.score[data.player]
      : data.settings.damage
    if (data.score[data.player] <= 0) {
      data.score[data.player] = 0
      data.players[data.player].dead = true
    }
    let survivors = []
    let players = []
    for (let player of Object.keys(data.score)) {
      players.push(player)
      if (data.score[player] > 0) {
        survivors.push(player)
      }
    }
    if (
      (survivors.length === 1 && players.length !== 1) ||
      (!survivors.length && players.length === 1)
    ) {
      data.winner = players[0]
    }
  } else {
    data.score[data.player] += data.player === id ? -1 : 1
    if (data.score[data.player] >= data.settings.goal || data.tie) {
      data.winner = data.player
    }
  }
  io.emit('goalScored', {
    x: data.ball.x,
    y: data.ball.y,
    color: data.players[data.player].color
  })
  if (data.winner) {
    handleWinner(data)
  } else {
    resetBall(data)
    resetPlayers(data)
  }
}

const updatePlayerPosition = (game, playerId, movement) => {
  const player = game.players[playerId]
  if (!player.side || !player.goal) return

  const { a, b } = player.side
  const playerSpeed = game.playerData.speed * (game.settings.playerSpeed / 5) // Use game settings

  if (!player.vx) player.vx = 0
  if (!player.vy) player.vy = 0

  if (movement && movement.right) {
    player.t = Math.max(player.goal.startT, player.t - playerSpeed)
  }
  if (movement && movement.left) {
    player.t = Math.min(player.goal.endT, player.t + playerSpeed)
  }

  // Calculate the new position based on 't'
  player.x = a.x + (b.x - a.x) * player.t
  player.y = a.y + (b.y - a.y) * player.t

  // Basic velocity calculation
  player.vx = (player.x - (player.lastX || player.x)) / (1000 / 90) // rough delta time
  player.vy = (player.y - (player.lastY || player.y)) / (1000 / 90) // rough delta time

  player.lastX = player.x
  player.lastY = player.y
}

const handleWinner = (game) => {
  clearInterval(timersIntervals[game.id])
  clearInterval(gameLoopsIntervals[game.id])
  clearInterval(effectsIntervals[game.id])
  io.to(game.id).emit('victory', game)
}

const gameLoop = (gameId) => {
  let game = games[gameId]
  let { players, ball, polygon } = game
  if (ball && !game.countdownTimer) {
    if (ball.bounces > 100) {
      resetBall(game)
      resetPlayers(game)
    }

    if (ball.bounceRemaining > 0) {
      ball.radius =
        game.ballData.radius * 1 +
        (ball.bounceExpansion - 1) * ball.bounceRemaining
      ball.bounceRemaining -= ball.bounceReduction
      if (ball.bounceRemaining < 0) {
        ball.bounceRemaining = 0
        ball.radius = game.ballData.radius
      }
    }

    let steps = Math.ceil(
      Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / ball.radius
    )

    for (let i = 0; i < steps; i++) {
      ball.x += ball.vx / steps
      ball.y += ball.vy / steps

      let minWallDist = ball.radius
      let minPlayerDist = ball.radius + game.playerData.radius

      // === Check for goal ===
      for (let id in players) {
        let player = players[id]
        if (!player.side || !player.goal) continue
        let { a, b } = player.side
        let { startT, endT } = player.goal

        let gx1 = a.x + (b.x - a.x) * startT
        let gy1 = a.y + (b.y - a.y) * startT
        let gx2 = a.x + (b.x - a.x) * endT
        let gy2 = a.y + (b.y - a.y) * endT

        let dx = gx2 - gx1
        let dy = gy2 - gy1
        let lengthSq = dx * dx + dy * dy
        let t = Math.max(
          0,
          Math.min(1, ((ball.x - gx1) * dx + (ball.y - gy1) * dy) / lengthSq)
        )
        let closestX = gx1 + t * dx
        let closestY = gy1 + t * dy

        let distX = ball.x - closestX
        let distY = ball.y - closestY
        let distSq = distX * distX + distY * distY

        let pdx = ball.x - player.x
        let pdy = ball.y - player.y
        let playerDistSq = pdx * pdx + pdy * pdy

        if (
          distSq <= ball.radius * ball.radius &&
          playerDistSq > (ball.radius + game.playerData.radius) ** 2
        ) {
          // goal
          let lastPlayerId = ball.player || id
          handleGoal({ ...game, player: lastPlayerId })
          // game.score[lastPlayerId] += lastPlayerId === id ? -1 : 1
          // // win conditions
          // if (game.score[lastPlayerId] >= game.settings.goal || game.tie) {
          //   game.winner = lastPlayerId
          //   handleWinner(game)
          //   break
          // }
          // resetBall(game)
          // resetPlayers(game)
          break
        }

        player = players[id]
        dx = ball.x - player.x
        dy = ball.y - player.y
        distSq = dx * dx + dy * dy

        if (player.bounceRemaining > 0) {
          player.radius =
            game.playerData.radius * 1 +
            (player.bounceExpansion - 1) * player.bounceRemaining
          player.bounceRemaining -= player.bounceReduction
          if (player.bounceRemaining < 0) {
            player.bounceRemaining = 0
            player.radius = game.playerData.radius
          }
        }

        if (distSq < minPlayerDist * minPlayerDist) {
          bounceAnimation({ player, ball })

          let dist = Math.sqrt(distSq) || 0.01
          let nx = dx / dist
          let ny = dy / dist

          let dot = ball.vx * nx + ball.vy * ny
          if (dot < 0) {
            let { vx, vy } = reflectVelocity(ball.vx, ball.vy, nx, ny)

            let angle = Math.atan2(vy, vx)
            let offset = (Math.random() - 0.5) * game.ballData.randomness
            let speed = Math.sqrt(vx * vx + vy * vy)
            ball.vx =
              Math.cos(angle + offset) *
              (speed + ball.bounces * game.ballData.speedToAdd)
            ball.vy =
              Math.sin(angle + offset) *
              (speed + ball.bounces * game.ballData.speedToAdd)
            ball.bounces += 1
          }

          let overlap = minPlayerDist - dist
          ball.x += nx * overlap
          ball.y += ny * overlap
        }
      }

      // === Bounce on polygon walls ===
      for (let i = 0; i < polygon.length; i++) {
        let a = polygon[i]
        let b = polygon[(i + 1) % polygon.length]

        let dx = b.x - a.x
        let dy = b.y - a.y
        let lengthSq = dx * dx + dy * dy

        let t = Math.max(
          0,
          Math.min(1, ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / lengthSq)
        )
        let closestX = a.x + t * dx
        let closestY = a.y + t * dy

        let distX = ball.x - closestX
        let distY = ball.y - closestY
        let distSq = distX * distX + distY * distY

        if (distSq < minWallDist * minWallDist) {
          bounceAnimation({ ball })
          let { x: normalX, y: normalY } = normalize(-dy, dx)
          let { vx, vy } = reflectVelocity(ball.vx, ball.vy, normalX, normalY)
          ball.vx = vx
          ball.vy = vy

          let overlap = minWallDist - Math.sqrt(distSq)
          ball.x += normalX * overlap
          ball.y += normalY * overlap

          let angle = Math.atan2(ball.vy, ball.vx)
          let offset = (Math.random() - 0.5) * game.ballData.randomness
          let speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
          ball.vx =
            Math.cos(angle + offset) *
            (speed + ball.bounces * game.ballData.speedToAdd)
          ball.vy =
            Math.sin(angle + offset) *
            (speed + ball.bounces * game.ballData.speedToAdd)
          ball.bounces += 1
        }
      }
    }
  }
  io.to(gameId).emit('game', game)
}

setInterval(() => {
  io.emit('lobies', games)
}, 1000)

server.listen(port, () => {
  console.log(`port ${port}`)
})
