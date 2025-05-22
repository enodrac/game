// FRONTEND CODE
let gameData
let movement = {}
let settings
let lobies = {}
let socket = io()

/*
  TODO
    - opcion para deshabilitar aberraciones = efectos
    - revisar que el tema de twitch este bien la desconeccion y la perdida del token
    - PULSO (la pelota aparece y desaparece pero sigue el mismo trajecto)
    - ECO (aparecen n pelotas mas)
    - TURBO (aumenta la velocidad de la pelota n%)
    - CAOS (la pelota se mueve erraticamente)
    - DISRUPCIÓN (los controles de los jugadores se invierten)
    - MUTACIÓN (cambia el poligono de los jugadores)
    - INERCIA (los jugadores se deslizan como si estuvieran en hielo)
    - GIRO (el poligono gira lentamente para cambiar la perspectiva)
*/

// Store client-side player history
let clientSidePrediction = {}

class Particle {
  constructor(x, y, color) {
    this.x = x
    this.y = y
    const angle = Math.random() * 2 * Math.PI
    const speed = Math.random() * 6
    this.color = color
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.size = Math.random() * 30
    this.life = 60
  }

  update(canvasContext) {
    this.x += this.vx
    this.y += this.vy
    this.life--
    this.size *= 0.95
    this.draw(canvasContext)
  }

  draw(canvasContext) {
    canvasContext.globalAlpha = this.life / 60
    canvasContext.fillStyle = this.color
    canvasContext.beginPath()
    canvasContext.shadowColor = 'white'
    canvasContext.shadowBlur = 10
    canvasContext.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    canvasContext.fill()
    canvasContext.globalAlpha = 1
  }
}

socket.on('lobies', (games) => {
  for (let id in games) {
    if (!lobies[id]) {
      lobies[id] = games[id]
      let loby = document.createElement('div')
      loby.textContent = `${games[id].name}: ${games[id].playerCount}`
      loby.id = id
      loby.classList.add('game')
      loby.classList.add('button')
      loby.addEventListener('click', (event) => {
        let selected = event.target.className.includes('selected')
        document
          .querySelectorAll('.game')
          .forEach((item) => item.classList.remove('selected'))
        loby.classList.add('selected')
        if (!selected) {
          document.getElementById('join').classList.remove('disable')
        }
      })
      lobies[id].display = 'flex'
      document.getElementById('games').appendChild(loby)
    } else if (games[id].polygon && lobies[id].display !== 'none') {
      document.getElementById(id).style.display = 'none'
      lobies[id].display = 'none'
    } else if (!games[id].polygon && lobies[id].display !== 'flex') {
      document.getElementById(id).style.display = 'flex'
      lobies[id].display = 'flex'
    } else if (
      lobies[id].playerCount !== games[id].playerCount ||
      lobies[id].name !== games[id].name
    ) {
      document.getElementById(
        id
      ).innerText = `${games[id].name}: ${games[id].playerCount}`
    }
  }
  for (let id in lobies) {
    if (!games[id]) {
      document.getElementById(id).remove()
      delete lobies[id]
    }
  }
})

socket.on('create', (game) => {
  gameData = game
  handleDisplayGameInit()
})

socket.on('start', () => {
  document.getElementById('game_canvas').style.display = 'flex'
  document.getElementById('info').style.display = 'flex'
  document.getElementById('middle').style.display = 'none'
})

socket.on('cancel', () => {
  gameData = undefined
  document.getElementById('middle').style.display = 'flex'
  document.getElementById('init').style.display = 'flex'
  document.getElementById('lobies').style.display = 'flex'
  document.getElementById('game_customization').style.display = 'none'
  document.getElementById('info').style.display = 'none'
  document.getElementById('loby').style.display = 'none'
  document.getElementById('chat').style.display = 'none'
  document.getElementById('game_canvas').style.display = 'none'
  document.getElementById('options').innerHTML = ''
})

socket.on('restart', (game) => {
  gameData = game
  handleDisplayGameInit()
})

socket.on('loby', (game) => {
  gameData = game
  if (gameData.messages.length) {
    setMessages(gameData)
  }
  setLobyPlayers()
})

socket.on('messages', (game) => {
  if (game.messages.length) {
    setMessages(game)
  }
})

socket.on('game', (game) => {
  gameData = game
})

socket.on('victory', (game) => {
  gameData = game
  document.getElementById('victory').classList.add('show')
})

socket.on('aberrations', (data) => {
  if (!data) {
    document.getElementById('aberrations').innerHTML = ``
  } else if (data.aberration) {
    document.getElementById('aberrations').innerHTML = `
      <div class="aberration box selected" style="background: var(--accent)">
      ${data.aberration.name}
      </div>
    `
  } else if (data.choises) {
    for (let name in data.choises) {
      let choise = data.choises[name]
      let aberration = document.createElement('div')
      aberration.id = choise.name
      aberration.classList.add('box')
      aberration.classList.add('aberration')
      aberration.innerText = choise.name
      aberration.addEventListener('click', (event) => {
        let selected = event.target.className.includes('selected')
        document
          .querySelectorAll('.aberration')
          .forEach((item) => item.classList.remove('selected'))
        if (!selected) {
          document.getElementById(choise.name).classList.add('selected')
        }
        socket.emit('aberrations', { game: gameData.id, choise })
      })
      document.getElementById('aberrations').appendChild(aberration)
    }
  } else {
    let totalVotes = 0
    for (let name in data) {
      totalVotes += Object.keys(data[name].votes).length
    }
    for (let name in data) {
      let aberration = document.getElementById(name)
      let percentage = (Object.keys(data[name].votes).length * 100) / totalVotes
      aberration.style.background = `linear-gradient(
        90deg,
        var(--accent) ${percentage}%,
        var(--background) ${percentage ? percentage + 5 : 0}%
      )`
    }
  }
})

const handleDisplayGameInit = () => {
  document.getElementById('options').innerHTML = ''
  document.getElementById('victory').classList.remove('show')
  document.getElementById('middle').style.display = 'flex'
  document.getElementById('player_customization').style.display = 'flex'
  document.getElementById('loby').style.display = 'flex'
  document.getElementById('chat').style.display = 'flex'
  document.getElementById('loby_label').innerText = gameData.name
  if (gameData.owner === socket.id) {
    document.getElementById('game_customization').style.display = 'flex'
    document.getElementById('connect_twitch').style.display = 'flex'
    document.getElementById('start_button').style.display = 'flex'
  } else {
    document.getElementById('game_customization').style.display = 'none'
    document.getElementById('connect_twitch').style.display = 'none'
    document.getElementById('start_button').style.display = 'none'
  }
  document.getElementById('init').style.display = 'none'
  document.getElementById('lobies').style.display = 'none'
  document.getElementById('game_canvas').style.display = 'none'
  document.getElementById('info').style.display = 'none'
  handleSettings()
  setLobyPlayers()
}

const setMessages = (game) => {
  document.getElementById('messages').innerHTML = game.messages
    .map(
      (item) => `
          <div class="message" style="color: ${
            item.id
              ? game.players[item.player]
                ? game.players[item.player].color
                : item.player.color
              : item.player.color
          }">
          <span class="time">
          ${new Date(item.time).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          })}
          </span>
          <span class="player">
          ${
            item.id
              ? game.players[item.player]
                ? game.players[item.player].name
                : item.player.name
              : item.player.name
          }:
          </span>
          <span class="text">
          ${item.message}
          </span>
          </div>
          `
    )
    .join('')
}

const setLobyPlayers = () => {
  document.getElementById('players').innerHTML = Object.values(gameData.players)
    .map(
      (player) =>
        `<div class="player box">
        ${player.name}
          <div class="mini_player" style="background-color: ${player.color};"></div>
        </div>`
    )
    .join('')
}

const shadeColor = (color, percent) => {
  let [r, g, b] = color.match(/\d+/g).map(Number)
  let adjust = (c) =>
    Math.min(255, Math.max(0, c + Math.round(255 * (percent / 100))))
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`
}

const generateColor = () => {
  return `rgb(${[...Array(3)]
    .map(() => Math.floor(Math.random() * 256))
    .join(',')})`
}

let examplePlayer = {
  x: 50,
  y: 50,
  radius: 50,
  color: generateColor()
}

const isColorLight = (r, g, b) => {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const handleSettings = () => {
  let gameModeOptions = []
  document.querySelectorAll('.game_mode').forEach((item) => {
    if (item.className.includes('selected')) {
      if (item.id === 'button_points') {
        gameModeOptions = [
          {
            label: `Puntos para ganar`,
            key: 'goal',
            value: 10,
            min: 1,
            max: 50
          }
        ]
      } else {
        gameModeOptions = [
          {
            label: `Vida del jugador`,
            key: 'health',
            value: 100,
            min: 10,
            max: 100,
            step: 10
          },
          {
            label: `Daño de la pelota`,
            key: 'damage',
            value: 20,
            min: 5,
            max: 100,
            step: 5
          }
        ]
      }
    }
  })
  settings = {}
  let options = [
    ...gameModeOptions,
    {
      label: `Velocidad del jugador`,
      key: 'playerSpeed',
      value: 5,
      min: 1,
      max: 10
    },
    {
      label: `Velocidad de la pelota`,
      key: 'ballSpeed',
      value: 5,
      min: 1,
      max: 10
    },
    {
      label: `Duracion del juego`,
      key: 'time',
      value: 5,
      min: 1,
      max: 10
    },
    {
      label: `Effectos`,
      key: 'aberrations',
      value: true
    }
  ]
  options.forEach((item) => {
    settings[item.key] = item.value
    let option = document.createElement('div')
    option.classList.add('option')
    let label = document.createElement('div')
    label.classList.add('label')
    label.innerText = item.label
    let value = document.createElement('div')
    value.classList.add('value')
    value.innerText =
      item.key === 'aberrations' ? (item.value ? 'si' : 'no') : item.value
    let arrowLeft = document.createElement('div')
    arrowLeft.classList.add('arrow')
    arrowLeft.classList.add('left')
    arrowLeft.addEventListener('click', () => {
      let newValue =
        item.key === 'aberrations'
          ? !settings[item.key]
          : settings[item.key] - (item.step || 1)
      if (
        (newValue >= item.min && newValue <= item.max) ||
        item.key === 'aberrations'
      ) {
        settings[item.key] = newValue
        value.innerText =
          item.key === 'aberrations' ? (newValue ? 'si' : 'no') : newValue
      }
    })
    let arrowRight = document.createElement('div')
    arrowRight.classList.add('arrow')
    arrowRight.classList.add('right')
    arrowRight.addEventListener('click', () => {
      let newValue =
        item.key === 'aberrations'
          ? !settings[item.key]
          : settings[item.key] + (item.step || 1)
      if (
        (newValue >= item.min && newValue <= item.max) ||
        item.key === 'aberrations'
      ) {
        settings[item.key] = newValue
        value.innerText =
          item.key === 'aberrations' ? (newValue ? 'si' : 'no') : newValue
      }
    })
    option.appendChild(label)
    option.appendChild(arrowLeft)
    option.appendChild(value)
    option.appendChild(arrowRight)
    document.getElementById('options').appendChild(option)
  })
}

let particles = []
socket.on('goalScored', (data) => {
  const numParticles = 101
  for (let i = 0; i < numParticles; i++) {
    particles.push(new Particle(data.x, data.y, data.color))
  }
})

const engine = () => {
  requestAnimationFrame(engine)

  if (!gameData || !gameData.polygon) {
    let canvas = document.getElementById('player_example')
    let canvasContext = canvas.getContext('2d')
    canvas.width = 100
    canvas.height = 100
    const gradient = canvasContext.createRadialGradient(
      examplePlayer.x - examplePlayer.radius * 0.3,
      examplePlayer.y - examplePlayer.radius * 0.3,
      examplePlayer.radius * 0.1,
      examplePlayer.x,
      examplePlayer.y,
      examplePlayer.radius
    )
    gradient.addColorStop(0, 'white')
    gradient.addColorStop(0.4, examplePlayer.color)
    gradient.addColorStop(1, shadeColor(examplePlayer.color, -40))
    canvasContext.fillStyle = gradient
    canvasContext.beginPath()
    canvasContext.arc(
      examplePlayer.x,
      examplePlayer.y,
      examplePlayer.radius,
      0,
      Math.PI * 2
    )
    canvasContext.fill()
  }

  if (gameData && gameData.polygon) {
    document.getElementById('time').innerText = formatTime(
      gameData.settings.time
    )
    document.getElementById(
      'goal'
    ).innerText = `Puntos: ${gameData.settings.goal}`
    let scores = []
    for (let id in gameData.score) {
      scores.push(
        `<div class="score box">
         <div class="mini_player" style="background-color: ${gameData.players[id].color};"></div>
        ${gameData.players[id].name}: ${gameData.score[id]}</div>`
      )
    }
    document.getElementById('scores').innerHTML = scores.join('')
    let canvas = document.getElementById('game_canvas')
    let canvasContext = canvas.getContext('2d')
    // Clear canvas
    canvasContext.fillStyle = '#292929'
    canvasContext.fillRect(0, 0, innerWidth, innerHeight)
    canvasContext.save()

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Send movement input
    if (
      (movement.left || movement.right) &&
      !gameData.winner &&
      !gameData.countdownTimer
    ) {
      socket.emit('player', { movement, gameId: gameData.id })
      predictPlayerMovement(movement, gameData.id)
    }

    let { a, b } = gameData.players?.[socket.id].side
    let mx = (a.x + b.x) / 2
    let my = (a.y + b.y) / 2
    let cx = gameData.area.x
    let cy = gameData.area.y
    let dx = cx - mx
    let dy = cy - my
    let angle = Math.atan2(dy, dx) + Math.PI / 2

    // === Rotate canvas to place player on the bottom ===
    canvasContext.translate(canvas.width / 2, canvas.height / 2)
    canvasContext.rotate(-angle)
    canvasContext.translate(-cx, -cy)

    let center = { x: cx, y: cy }
    let players = gameData.players

    // === Draw triangle areas + goal lines (layer 1) ===
    for (let id in players) {
      let player = players[id]

      let { a, b } = player.side
      let { startT, endT } = player.goal
      let goalOffset = gameData.playerCount > 5 ? 0 : 0.15

      let gx1 = a.x + (b.x - a.x) * (startT - goalOffset)
      let gy1 = a.y + (b.y - a.y) * (startT - goalOffset)
      let gx2 = a.x + (b.x - a.x) * (endT + goalOffset)
      let gy2 = a.y + (b.y - a.y) * (endT + goalOffset)

      // Fill triangle area
      canvasContext.beginPath()
      canvasContext.moveTo(gx1, gy1)
      canvasContext.lineTo(gx2, gy2)
      canvasContext.lineTo(center.x, center.y)
      canvasContext.closePath()
      canvasContext.fillStyle = player.color
      canvasContext.globalAlpha = 0.2
      canvasContext.fill()
      canvasContext.globalAlpha = 1

      // Draw goal line
      let trueGx1 = a.x + (b.x - a.x) * startT
      let trueGy1 = a.y + (b.y - a.y) * startT
      let trueGx2 = a.x + (b.x - a.x) * endT
      let trueGy2 = a.y + (b.y - a.y) * endT

      canvasContext.beginPath()
      canvasContext.moveTo(trueGx1, trueGy1)
      canvasContext.lineTo(trueGx2, trueGy2)

      if (player.leave) {
        canvasContext.globalAlpha = 0.7
        canvasContext.lineWidth = 4
        canvasContext.shadowBlur = 4
      } else {
        canvasContext.shadowColor = 'white'
        canvasContext.lineWidth = 10
        canvasContext.shadowBlur = 10
      }
      canvasContext.strokeStyle = player.color
      canvasContext.stroke()
      canvasContext.shadowBlur = 0
      canvasContext.save()
      canvasContext.restore()
    }

    // Draw polygon border
    canvasContext.strokeStyle = 'white'
    canvasContext.lineWidth = 2
    canvasContext.beginPath()
    let vertices = gameData.polygon
    canvasContext.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      canvasContext.lineTo(vertices[i].x, vertices[i].y)
    }
    canvasContext.closePath()
    canvasContext.stroke()

    canvasContext.restore()
    canvasContext.save()

    for (let id in players) {
      let player = players[id]
      if (!player.leave) {
        canvasContext.translate(player.x, player.y)
        canvasContext.rotate(angle)

        let gradient = canvasContext.createRadialGradient(
          -player.radius * 0.3,
          -player.radius * 0.3,
          player.radius * 0.1,
          0,
          0,
          player.radius
        )

        gradient.addColorStop(0, 'white')
        gradient.addColorStop(0.4, player.color)
        gradient.addColorStop(1, shadeColor(player.color, -40))

        canvasContext.fillStyle = gradient
        canvasContext.beginPath()
        canvasContext.arc(0, 0, player.radius, 0, Math.PI * 2)
        canvasContext.fill()

        canvasContext.restore()
        canvasContext.save()
      }
    }

    let ball = gameData.ball

    canvasContext.save()

    // Move to ball center
    canvasContext.translate(ball.x, ball.y)
    // Reverse the canvas rotation
    canvasContext.rotate(angle)

    // Create gradient relative to (0, 0)
    let gradient = canvasContext.createRadialGradient(
      -ball.radius * 0.4,
      -ball.radius * 0.4,
      ball.radius * 0.1,
      0,
      0,
      ball.radius
    )

    gradient.addColorStop(0, 'white')
    gradient.addColorStop(0.4, ball.color)
    gradient.addColorStop(1, shadeColor(ball.color, -40))

    canvasContext.shadowColor = 'white'
    canvasContext.shadowBlur = 6

    canvasContext.beginPath()
    canvasContext.arc(0, 0, ball.radius, 0, Math.PI * 2)
    canvasContext.fillStyle = gradient
    canvasContext.fill()

    canvasContext.shadowBlur = 0
    canvasContext.restore()

    for (let i = 0; i < particles.length; i++) {
      particles[i].update(canvasContext)

      if (particles[i].life <= 0) {
        particles.splice(i, 1)
        i--
      }
    }

    if (gameData.countdownTimer > 0) {
      canvasContext.restore() // undo the rotation

      // Reset transform so countdown is drawn in screen space
      canvasContext.setTransform(1, 0, 0, 1, 0, 0)

      canvasContext.fillStyle = 'white'
      canvasContext.font = 'bold 100px sans-serif'
      canvasContext.textAlign = 'center'
      canvasContext.textBaseline = 'middle'
      canvasContext.shadowColor = 'black'
      canvasContext.shadowBlur = 10

      canvasContext.fillText(
        gameData.countdownTimer,
        canvas.width / 2,
        canvas.height / 2
      )

      canvasContext.shadowBlur = 0

      return
    }
  }
}

let lastMovement = { left: false, right: false }

function emitIfChanged() {
  if (gameData && gameData.id) {
    if (
      movement.left !== lastMovement.left ||
      movement.right !== lastMovement.right
    ) {
      socket.emit('player', { movement, gameId: gameData.id })
      lastMovement = { ...movement }
    }
  }
}

const handleMovement = (event, start) => {
  if (event.key.toLowerCase() === 'a') {
    movement.left = start
    if (start) movement.right = false
  } else if (event.key.toLowerCase() === 'd') {
    movement.right = start
    if (start) movement.left = false
  }
  // emitIfChanged()
}

const handleCreate = () => {
  const input = document.getElementById('name')
  const value = input.value

  socket.emit('create', {
    name: value,
    color: examplePlayer.color
  })
}

const handleStart = () => {
  socket.emit('start', {
    gameId: gameData.id,
    settings: { ...settings, time: settings.time * 60 }
  })
}

const handleCancel = () => {
  socket.emit('cancel', { game: gameData.id })
}

const handleJoin = () => {
  const input = document.getElementById('name')
  const value = input.value
  let game = [...document.getElementsByClassName('selected')].pop()
  socket.emit('join', { id: game.id, name: value, color: examplePlayer.color })
}

document.getElementById('name').addEventListener('input', (data) => {
  if (data.target.value.length) {
    document.getElementById('create').classList.remove('disable')
  } else {
    document.getElementById('create').classList.add('disable')
  }
})

const handleColor = (data) => {
  document.getElementById(`${data.type}_slider_value`).innerText =
    data.event.target.value
  let [red, green, blue] = examplePlayer.color.match(/\d+/g).map(Number)
  values = {
    red,
    green,
    blue,
    [data.type]: data.event.target.value
  }
  let color = `rgb(${values.red},${values.green},${values.blue})`
  examplePlayer.color = color
  if (gameData && gameData.id) {
    debouncedEmitColor(color)
  }
}

function debounce(fn, delay) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn.apply(this, args), delay)
  }
}

const debouncedEmitColor = debounce((color) => {
  socket.emit('color', { id: gameData.id, player: socket.id, color })
}, 100)

const handleTheme = (data) => {
  if (data.target.id === 'handle_theme') {
    let themes = document.getElementById('themes')
    if (themes.className.includes('hidden')) {
      themes.classList.remove('hidden')
    } else {
      themes.classList.add('hidden')
    }
  } else {
    document.body.classList = ''
    document.body.classList.add(`theme-${data.target.id}`)
    document
      .querySelectorAll('.example_color')
      .forEach((item) => item.classList.remove('selected'))
    document.getElementById(data.target.id).classList.add('selected')
  }
}

const handleChat = (data) => {
  let message = document.getElementById('message_input')
  if (data.target.id === 'handle_chat') {
    let themes = document.getElementById('chat')
    if (themes.className.includes('hidden')) {
      themes.classList.remove('hidden')
    } else {
      themes.classList.add('hidden')
    }
  } else if (
    message.value?.length &&
    (data.key === 'Enter' || data.target.id === 'message_button')
  ) {
    socket.emit('messages', {
      id: gameData.id,
      player: socket.id,
      message: message.value
    })
    message.value = ''
    document.getElementById('message_button').classList.add('disable')
  } else if (message.value?.length) {
    document.getElementById('message_button').classList.remove('disable')
  } else {
    document.getElementById('message_button').classList.add('disable')
  }
}

const handleTwitch = () => {
  let clientId = '5wb51e7c3wcd25lhryn9p5yc305ort'
  let redirectUri = 'http://localhost:3000/twitch/callback'
  let scope = 'chat:read chat:edit'
  let gameId = gameData?.id

  let authUrl =
    `https://id.twitch.tv/oauth2/authorize` +
    `?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${gameId}`

  // Open the popup window
  let popup = window.open(authUrl, 'twitchAuth', 'width=500,height=600')
  const checkPopupForSuccess = () => {
    if (popup.closed) {
      console.log('Popup closed')
    } else {
      try {
        const popupBody = popup.document.body
          ? popup.document.body.innerText
          : ''
        if (popupBody.includes('Authentication successful!')) {
          setTimeout(() => {
            popup.close()
          }, 2000)
        }
      } catch (e) {
        console.log(
          'Unable to access popup content due to cross-origin restrictions'
        )
      }
      setTimeout(() => checkPopupForSuccess(), 1000)
    }
  }
  checkPopupForSuccess()
}

const handleContinue = () => {
  socket.emit('restart', { gameId: gameData.id })
}

const handleGameMode = (event) => {
  document.getElementById('options').innerHTML = ''
  document
    .querySelectorAll('.game_mode')
    .forEach((item) => item.classList.remove('selected'))
  event.target.classList.add('selected')
  handleSettings()
}

const handleRandomColor = () => {
  let color = generateColor()
  let [red, green, blue] = color.match(/\d+/g).map(Number)
  examplePlayer.color = color
  document.getElementById('red_slider_value').innerText = red
  document.getElementById('red_slider').value = red
  document.getElementById('green_slider_value').innerText = green
  document.getElementById('green_slider').value = green
  document.getElementById('blue_slider_value').innerText = blue
  document.getElementById('blue_slider').value = blue
  debouncedEmitColor(color)
}

const predictPlayerMovement = (movement, gameId) => {
  if (!gameData || !gameData.players || !gameData.players[socket.id]) return

  const player = gameData.players[socket.id]

  if (!clientSidePrediction[gameId]) {
    clientSidePrediction[gameId] = {
      inputBuffer: [], // Store the client's inputs
      reconcileThreshold: 10 // maximum difference to reconcile (adjust this value)
    }
  }
  let prediction = clientSidePrediction[gameId]

  const { a, b } = gameData.players?.[socket.id].side
  const playerSpeed = 0.01 * (gameData.settings.playerSpeed / 5) // Match with server speed

  let predictedX = player.x
  let predictedY = player.y
  let predictedT = player.t

  if (movement && movement.right) {
    predictedT = Math.max(player.goal.startT, player.t - playerSpeed)
  }
  if (movement && movement.left) {
    predictedT = Math.min(player.goal.endT, player.t + playerSpeed)
  }

  predictedX = a.x + (b.x - a.x) * predictedT
  predictedY = a.y + (b.y - a.y) * predictedT

  player.x = predictedX
  player.y = predictedY
  player.t = predictedT

  // Store the input with a timestamp
  prediction.inputBuffer.push({
    input: movement,
    timestamp: Date.now()
  })
}

socket.on('server_update', (data) => {
  if (!gameData || gameData.id !== data.gameId) return
  if (!gameData.players[socket.id]) return

  const player = gameData.players[socket.id]
  if (!clientSidePrediction[data.gameId]) return

  let prediction = clientSidePrediction[data.gameId]
  let inputBuffer = prediction.inputBuffer

  // Server Reconciliation
  let serverPos = { x: data.x, y: data.y }
  let clientPos = { x: player.x, y: player.y }

  // Calculate the difference between server and client positions
  let dx = serverPos.x - clientPos.x
  let dy = serverPos.y - clientPos.y
  let distance = Math.sqrt(dx * dx + dy * dy)

  // If the client is too far from the server, reconcile
  if (distance > prediction.reconcileThreshold) {
    // Set the client's position to the server's position
    player.x = data.x
    player.y = data.y
    player.t = player.side.a.x + (player.side.b.x - player.side.a.x) * data.x //this line will throw an error
    // Clear the input buffer
    inputBuffer = []
    prediction.inputBuffer = []
  }

  // Always reconcile, but gradually
  player.x = data.x * 0.25 + player.x * 0.75
  player.y = data.y * 0.25 + player.y * 0.75
})

const test = () => {
  socket.emit('test', { game: gameData.id })
}

document
  .getElementById('connect_twitch')
  .addEventListener('click', handleTwitch)

document
  .getElementById('red_slider')
  .addEventListener('input', (event) => handleColor({ event, type: 'red' }))
document.getElementById('red_slider').value = examplePlayer.color
  .match(/\d+/g)
  .map(Number)[0]
document.getElementById('red_slider_value').innerText = examplePlayer.color
  .match(/\d+/g)
  .map(Number)[0]
document
  .getElementById('green_slider')
  .addEventListener('input', (event) => handleColor({ event, type: 'green' }))
document.getElementById('green_slider').value = examplePlayer.color
  .match(/\d+/g)
  .map(Number)[1]
document.getElementById('green_slider_value').innerText = examplePlayer.color
  .match(/\d+/g)
  .map(Number)[1]
document
  .getElementById('blue_slider')
  .addEventListener('input', (event) => handleColor({ event, type: 'blue' }))
document.getElementById('blue_slider').value = examplePlayer.color
  .match(/\d+/g)
  .map(Number)[2]
document.getElementById('blue_slider_value').innerText = examplePlayer.color
  .match(/\d+/g)
  .map(Number)[2]
document
  .querySelectorAll('.example_color')
  .forEach((item) => item.addEventListener('click', handleTheme))
document.getElementById('message_input').addEventListener('input', handleChat)
document.getElementById('message_button').addEventListener('click', handleChat)
document.getElementById('handle_chat').addEventListener('click', handleChat)
document.getElementById('handle_theme').addEventListener('click', handleTheme)
document.getElementById('test').addEventListener('click', test)
document.getElementById('cancel_button').addEventListener('click', handleCancel)
document.getElementById('leave_button').addEventListener('click', handleCancel)
document.getElementById('create').addEventListener('click', handleCreate)
document.getElementById('join').addEventListener('click', handleJoin)
document
  .getElementById('button_points')
  .addEventListener('click', handleGameMode)
document
  .getElementById('button_health')
  .addEventListener('click', handleGameMode)
document
  .getElementById('continue_button')
  .addEventListener('click', handleContinue)
document.getElementById('start_button').addEventListener('click', handleStart)
document
  .getElementById('random_color_button')
  .addEventListener('click', handleRandomColor)
window.addEventListener('keydown', (event) => handleMovement(event, true))
window.addEventListener('keyup', (event) => handleMovement(event, false))

engine()
