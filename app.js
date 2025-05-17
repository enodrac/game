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
let timers = {}
let area = {
  x: 400,
  y: 300,
  radius: 300
}
let playerData = {
  speed: 0.01,
  radius: 35
}
let ballData = {
  speed: 3,
  randomness: 0.01,
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
      console.log(`${tags['display-name']}: ${message}`)
      if (message.toLowerCase().includes('speed')) {
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
    radius: playerData.radius,
    color: data.color ? data.color : generateColor()
  }
}

const generateColor = () => {
  return `rgb(${[...Array(3)]
    .map(() => Math.floor(Math.random() * 256))
    .join(',')})`
}

io.on('connection', (socket) => {
  socket.on('start', (data) => {
    let game = games[data.gameId]
    game.settings = data.settings
    let { players, playerCount } = game
    //? enodrac -
    // let auxPlayers = [...Array(1)]
    // auxPlayers.forEach((item) => {
    //   game.playerCount++
    //   players[generateId()] = {
    //     name: generateId(),
    //     radius: playerData.radius,
    //     color: generateColor()
    //   }
    // })
    // game.players = players
    // playerCount = game.playerCount
    //? enodrac -
    playerCount = playerCount === 1 || playerCount === 2 ? 4 : playerCount
    let polygon = generatePolygon(playerCount)
    game.area = area
    game.polygon = polygon
    game.playerCount = playerCount
    resetPlayers(game)
    let ball = {
      radius: ballData.radius,
      bounces: 0,
      speedToAdd: 0.05
    }
    game.ball = ball
    ballAimRandomPlayer(game)
    let interval = setInterval(() => {
      if (game.settings.time <= 0) {
        let maxScore = -Infinity
        let topPlayers = []
        for (const playerId in players) {
          const player = players[playerId]
          if (player.score > maxScore) {
            maxScore = player.score
            topPlayers = [playerId]
          } else if (player.score === maxScore) {
            topPlayers.push(playerId)
          }
        }
        if (topPlayers.length > 1) {
          game.settings.time = 0
          game.tie = true
        } else {
          game.winner = topPlayers[0]
          clearInterval(interval)
        }
      }
      if (!game.countdownTimer) {
        game.settings.time = game.settings.time + (game.tie ? 1 : -1)
      }
    }, 1000)
    timers[game.id] = interval
  })

  socket.on('join', (data) => {
    let game
    if (data.id) {
      game = games[data.id]
    } else {
      if (!Object.keys(games).length) {
        games[generateId()] = {
          players: {},
          playerCount: 0
        }
      }
      for (let id in games) {
        if (!game) {
          game = games[id]
        } else if (games[id].playerCount > game.playerCount) {
          game = games[id]
        }
      }
    }
    game.players[socket.id] = {
      ...generatePlayer(data),
      id: socket.id
    }
    game.playerCount++
  })

  socket.on('disconnect', () => {
    handleCancel({ player: { id: socket.id } })
  })

  socket.on('cancel', () => {
    handleCancel({ player: { id: socket.id } })
  })

  socket.on('message', (data) => {
    games[data.id].messages.unshift({
      player: data.player,
      message: data.message
    })
  })

  socket.on('create', (data) => {
    let gameId = generateId()
    games[gameId] = {
      id: gameId,
      owner: socket.id,
      name: `Sala de: ${data.name}`,
      score: {},
      players: {
        [socket.id]: {
          ...generatePlayer(data),
          id: socket.id
        }
      },
      playerCount: 1,
      messages: []
    }
  })

  socket.on('color', (data) => {
    games[data.id].players[data.player].color = data.color
  })

  socket.on('player', (data) => {
    let player = games[data.gameId].players[socket.id]
    player.movement = data.movement
  })

  socket.on('restart', (data) => {
    handleRestartGame(games[data.gameId])
  })
})

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
    (dx / length) * (ballData.speed * (data.settings.ballSpeed / 5))
  data.ball.vy =
    (dy / length) * (ballData.speed * (data.settings.ballSpeed / 5))
}

const handleRestartGame = (data) => {
  games[data.id] = {
    id: data.id,
    players: data.players,
    settings: data.settings,
    owner: data.owner,
    name: data.name,
    playerCount: data.playerCount,
    messages: data.messages,
    score: {}
  }
}

const handleCancel = (data) => {
  for (let id in games) {
    if (games[id].players[data.player.id]) {
      delete games[id].players[data.player.id]
      games[id].playerCount--
    }
    if (!games[id].playerCount || games[id].owner === data.player.id) {
      const client = twitchClients.get(id)
      if (client) {
        client.disconnect()
        twitchClients.delete(id)
      }
      delete games[id]
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
      data.score[id] = 0
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
  ballAimRandomPlayer(data)
  data.ball.bounces = 0
  data.countdownTimer = 3
  let countdownInterval = setInterval(() => {
    data.countdownTimer--
    if (data.countdownTimer === 0) {
      clearInterval(countdownInterval)
    }
  }, 1000)
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

setInterval(() => {
  for (let gameId in games) {
    let game = games[gameId]
    let { players, ball, polygon } = game
    if (ball && !game.countdownTimer && !game.winner) {
      if (ball.bounces > 500) {
        resetBall(game)
        resetPlayers(game)
      }

      if (ball.bounceRemaining > 0) {
        ball.radius =
          ballData.radius * 1 +
          (ball.bounceExpansion - 1) * ball.bounceRemaining
        ball.bounceRemaining -= ball.bounceReduction
        if (ball.bounceRemaining < 0) {
          ball.bounceRemaining = 0
          ball.radius = ballData.radius
        }
      }

      if (game.polygon) {
        for (let id in players) {
          let player = players[id]
          if (!player.side || !player.goal) continue
          let { a, b } = player.side
          if (player.movement && player.movement.right) {
            player.t = Math.max(
              player.goal.startT,
              player.t - playerData.speed * (game.settings.playerSpeed / 5)
            )
          }
          if (player.movement && player.movement.left) {
            player.t = Math.min(
              player.goal.endT,
              player.t + playerData.speed * (game.settings.playerSpeed / 5)
            )
          }
          player.x = a.x + (b.x - a.x) * player.t
          player.y = a.y + (b.y - a.y) * player.t
        }
      }

      let steps = Math.ceil(
        Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / ball.radius
      )

      for (let i = 0; i < steps; i++) {
        ball.x += ball.vx / steps
        ball.y += ball.vy / steps

        let minWallDist = ball.radius
        let minPlayerDist = ball.radius + playerData.radius

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
            playerDistSq > (ball.radius + playerData.radius) ** 2
          ) {
            let lastPlayerId = ball.player || id
            game.score[lastPlayerId] += lastPlayerId === id ? -1 : 1
            // win conditions
            if (game.score[lastPlayerId] >= game.settings.goal || game.tie) {
              game.winner = lastPlayerId
              clearInterval(timers[game.id])
              break
            }
            resetBall(game)
            resetPlayers(game)
            break
          }

          player = players[id]
          dx = ball.x - player.x
          dy = ball.y - player.y
          distSq = dx * dx + dy * dy

          if (player.bounceRemaining > 0) {
            player.radius =
              playerData.radius * 1 +
              (player.bounceExpansion - 1) * player.bounceRemaining
            player.bounceRemaining -= player.bounceReduction
            if (player.bounceRemaining < 0) {
              player.bounceRemaining = 0
              player.radius = playerData.radius
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
              let offset = (Math.random() - 0.5) * ballData.randomness
              let speed = Math.sqrt(vx * vx + vy * vy)
              ball.vx =
                Math.cos(angle + offset) *
                (speed + ball.bounces * ball.speedToAdd)
              ball.vy =
                Math.sin(angle + offset) *
                (speed + ball.bounces * ball.speedToAdd)
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
            let offset = (Math.random() - 0.5) * ballData.randomness
            let speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
            ball.vx =
              Math.cos(angle + offset) *
              (speed + ball.bounces * ball.speedToAdd)
            ball.vy =
              Math.sin(angle + offset) *
              (speed + ball.bounces * ball.speedToAdd)
            ball.bounces += 1
          }
        }
      }
    }
  }
  // === Emit updated game state ===
  io.emit('games', games)
}, 1000 / 90)

server.listen(port, () => {
  console.log(`Enodrac - port`, port)
})
