let gameData
let movement = {}
let settings
let lobies = {}
let socket = io()

/*
  TODO
    - CAMBIAR VELCIDAD DE JUGADOR POR OPCIONES DEL JUEGO
    - CAMBIAR VELCIDAD DE LA PELOTA POR OPCIONES DEL JUEGO
  X - ANIMACION DE VICTORIA
  X - SOFT RESET CUANDO HAY VICTORIA
    - EFECTOS AL ANOTAR UN GOL
  X - COLOR ALEATORIO NO CAMBIA EL MINI_PLAYER
  X - PELOTA CON COLOR DE QUIEN LE PEGO
    - CUANDO EL DUEÑO SE VA QUE CAMBIE EL NOMBRE DE LA SALA Y EL DUEÑO DEL A PARTIDA
  X - VICTORIA POR PUNTOS
  X - VICTORIA POR TIEMPO
  X - DESEMPATE
*/

socket.on('games', (games) => {
  let auxGameData
  for (let id in games) {
    let game = games[id]
    if (game.players[socket.id]) {
      auxGameData = games[id]
      auxGameData.id = id
    }
  }
  if (auxGameData) {
    gameData = auxGameData
    if (gameData.winner) {
      document.getElementById('victory').classList.add('show')
    } else {
      document.getElementById('victory').classList.remove('show')
    }
    document.getElementById('lobies').style.display = 'none'
    document.getElementById('chat').style.display = 'flex'
    document.getElementById('loby_label').innerText = gameData.name
    if (gameData.owner === socket.id) {
      document.getElementById('connect_twitch').style.display = 'flex'
    }
    if (!gameData.polygon) {
      document.getElementById('middle').style.display = 'flex'
      document.getElementById('init').style.display = 'none'
      document.getElementById('loby').style.display = 'flex'
      document.getElementById('game_customization').style.display = 'flex'
      document.getElementById('info').style.display = 'none'
      document.getElementById('game_canvas').style.display = 'none'
      if (!settings) {
        handleSettings()
      }
    } else {
      document.getElementById('middle').style.display = 'none'
      document.getElementById('game_canvas').style.display = 'flex'
      // document.getElementById('middle').style.display = 'flex'
      document.getElementById('info').style.display = 'flex'
      document.getElementById('options').innerHTML = ''
      settings = undefined
    }
    if (gameData.messages) {
      messages = []
      gameData.messages.forEach((item) => {
        messages.push(`
          <div class="message" style="color: ${
            gameData.players[item.player].color
          }">
          <span class="player">
          ${gameData.players[item.player].name}:
          </span>
          <span class="text">
          ${item.message}
          </span>
          </div>
          `)
      })
      if (messages.length) {
        document.getElementById('messages').innerHTML = messages.join('')
      }
    }
  } else {
    document.getElementById('middle').style.display = 'flex'
    document.getElementById('init').style.display = 'flex'
    document.getElementById('lobies').style.display = 'flex'
    document.getElementById('chat').style.display = 'none'
    document.getElementById('loby_label').innerText = ''
    document.getElementById('game_canvas').style.display = 'none'
    document.getElementById('loby').style.display = 'none'
    document.getElementById('game_customization').style.display = 'none'
    document.getElementById('info').style.display = 'none'
    document.getElementById('options').innerHTML = ''
    gameData = undefined
    settings = undefined
  }
  if (!gameData) {
    for (let id in games) {
      if (!lobies[id]) {
        lobies[id] = true
        let loby = document.createElement('div')
        loby.textContent = `${games[id].name}: ${games[id].playerCount}`
        loby.id = id
        loby.classList.add('game')
        loby.classList.add('button')
        loby.addEventListener('click', () => {
          document
            .querySelectorAll('.game')
            .forEach((item) => item.classList.remove('selected'))
          loby.classList.add('selected')
          document.getElementById('join').classList.remove('disable')
        })
        document.getElementById('games').appendChild(loby)
      } else if (lobies[id].playerCount !== games[id].playerCount) {
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
  }
})

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
  settings = {}
  let options = [
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
      label: `Puntos para ganar`,
      key: 'goal',
      value: 10,
      min: 1,
      max: 50
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
    value.innerText = item.value
    let arrowLeft = document.createElement('div')
    arrowLeft.classList.add('arrow')
    arrowLeft.classList.add('left')
    arrowLeft.addEventListener('click', () => {
      let newValue = settings[item.key] - 1
      if (newValue >= item.min && newValue <= item.max) {
        settings[item.key] = newValue
        value.innerText = newValue
      }
    })
    let arrowRight = document.createElement('div')
    arrowRight.classList.add('arrow')
    arrowRight.classList.add('right')
    arrowRight.addEventListener('click', () => {
      let newValue = settings[item.key] + 1
      if (newValue >= item.min && newValue <= item.max) {
        settings[item.key] = newValue
        value.innerText = newValue
      }
    })
    option.appendChild(label)
    option.appendChild(arrowLeft)
    option.appendChild(value)
    option.appendChild(arrowRight)
    document.getElementById('options').appendChild(option)
  })
}

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
    const canvas = document.getElementById('game_canvas')
    const canvasContext = canvas.getContext('2d')
    // Clear canvas
    canvasContext.fillStyle = '#292929'
    canvasContext.fillRect(0, 0, innerWidth, innerHeight)
    canvasContext.save()

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Send movement input
    if (movement.left || movement.right) {
      socket.emit('player', { movement, gameId: gameData.id })
    }

    const { a, b } = gameData.players?.[socket.id].side
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const cx = gameData.area.x
    const cy = gameData.area.y
    const dx = cx - mx
    const dy = cy - my
    const angle = Math.atan2(dy, dx) + Math.PI / 2

    // === Rotate canvas to place player on the bottom ===
    canvasContext.translate(canvas.width / 2, canvas.height / 2)
    canvasContext.rotate(-angle)
    canvasContext.translate(-cx, -cy)

    const center = { x: cx, y: cy }
    const players = gameData.players

    // === Draw triangle areas + goal lines (layer 1) ===
    for (const id in players) {
      const player = players[id]

      const { a, b } = player.side
      const { startT, endT } = player.goal
      const goalOffset = gameData.playerCount > 5 ? 0 : 0.15

      const gx1 = a.x + (b.x - a.x) * (startT - goalOffset)
      const gy1 = a.y + (b.y - a.y) * (startT - goalOffset)
      const gx2 = a.x + (b.x - a.x) * (endT + goalOffset)
      const gy2 = a.y + (b.y - a.y) * (endT + goalOffset)

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
      const trueGx1 = a.x + (b.x - a.x) * startT
      const trueGy1 = a.y + (b.y - a.y) * startT
      const trueGx2 = a.x + (b.x - a.x) * endT
      const trueGy2 = a.y + (b.y - a.y) * endT

      canvasContext.beginPath()
      canvasContext.moveTo(trueGx1, trueGy1)
      canvasContext.lineTo(trueGx2, trueGy2)
      canvasContext.strokeStyle = player.color
      canvasContext.lineWidth = 8
      canvasContext.shadowColor = 'white'
      canvasContext.shadowBlur = 10
      canvasContext.stroke()
      canvasContext.shadowBlur = 0
      canvasContext.save()
      canvasContext.restore()
    }

    // Draw polygon border
    canvasContext.strokeStyle = 'white'
    canvasContext.lineWidth = 2
    canvasContext.beginPath()
    const vertices = gameData.polygon
    canvasContext.moveTo(vertices[0].x, vertices[0].y)
    for (let i = 1; i < vertices.length; i++) {
      canvasContext.lineTo(vertices[i].x, vertices[i].y)
    }
    canvasContext.closePath()
    canvasContext.stroke()

    canvasContext.restore()
    canvasContext.save()

    for (const id in players) {
      let player = players[id]
      // Move to player center
      canvasContext.translate(player.x, player.y)
      // Reverse the canvas rotation
      canvasContext.rotate(angle)

      // Draw the gradient relative to (0,0)
      const gradient = canvasContext.createRadialGradient(
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

    const ball = gameData.ball

    canvasContext.save()

    // Move to ball center
    canvasContext.translate(ball.x, ball.y)
    // Reverse the canvas rotation
    canvasContext.rotate(angle)

    // Create gradient relative to (0, 0)
    const gradient = canvasContext.createRadialGradient(
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
  } else if (gameData) {
    let players = []
    for (const id in gameData.players) {
      players.push(`<div class="player box">
        ${gameData.players[id].name}
          <div class="mini_player" style="background-color: ${gameData.players[id].color};"></div>
        </div>`)
    }
    document.getElementById('players').innerHTML = players.join('')
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
  emitIfChanged()
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
  socket.emit('cancel')
}

const handleJoin = () => {
  const input = document.getElementById('name')
  const value = input.value
  let game = [...document.getElementsByClassName('selected')].pop()
  socket.emit('join', { id: game.id, name: value })
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
    socket.emit('message', {
      id: gameData.id,
      player: socket.id,
      message: message.value
    })
    message.value = ''
    document.getElementById('message_button').classList.add('disable')
  } else if (message.value?.length) {
    document.getElementById('message_button').classList.remove('disable')
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
document.getElementById('message_input').addEventListener('keydown', handleChat)
document.getElementById('message_button').addEventListener('click', handleChat)
document.getElementById('handle_chat').addEventListener('click', handleChat)
document.getElementById('handle_theme').addEventListener('click', handleTheme)
document.getElementById('cancel_button').addEventListener('click', handleCancel)
document.getElementById('leave_button').addEventListener('click', handleCancel)
document.getElementById('create').addEventListener('click', handleCreate)
document.getElementById('join').addEventListener('click', handleJoin)
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
