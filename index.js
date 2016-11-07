'use strict';
var EventEmitter = require('events')

// helpers
function shuffle(a) {
    var j, x, i;
    for(i = a.length; i; i -= 1) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
}


class DoctorTask extends EventEmitter {
    constructor(game) {
        super()

        this.game = game
        this.game.on(game.NIGHT_STARTED, this.start_action)
        this.game.on(game.NIGHT_ENDED, this.end_action)

    }
    start_action(cb) {
        this.game.rfa(display, game.getByRole(roles.doctor.id), (choices) => {
            if(!choices) {
                return cb()
            }

            this.choice = choice
            cb()
        })
    }
    end_action(cb) {
        this.choice.emit('heal')
        cb()
    }
}


class VoteTask extends EventEmitter {
    constructor(game) {
        super()

        this.game = game
        this.game.on(game.DAY_STARTED, this.start_action)
        this.game.on(game.DAY_ENDED, this.end_action)

    }
    start_action(cb) {
        this.game.broadcast('talk_time', 45)
        this.game.wait(45).then(() => {
            this.game.rfa(15, display, game.players, () => {

            })
        }).then(

        )
        this.game.wait(45)
        this.game.rfa(60, display, game.getByRole(roles.doctor.id), (choices) => {
            if(!choices) {
                return cb()
            }

            this.choice = choice
            cb()
        })
    }
    end_action(cb) {
        this.choice.emit('heal')
        cb()
    }
}



var roles = {
    doctor: {
        id: 'doctor',
        tasks: [DoctorTask],
        meta: {
            investigator: 'Upon investigation the target looks to be either a Doctor, a Werewolf, or a nobody',
            sheriff: 'The target appears to be aligned with the Town'
        }
    },
    werewolf: {
        id: 'werewolf',
        tasks: [VoteTask],
        meta: {
            investigator: 'Upon investigation the target looks to be either a Doctor, a Werewolf, or a nobody',
            sheriff: 'The target appears to not be aligned with the Town'
        }
    },
    nobody: {
        id: 'nobody',
        tasks: [VoteTask],
        meta: {
            investigator: 'Upon investigation the target looks to be either a Doctor, a Werewolf, or a nobody',
            sheriff: 'The target appears to be aligned with the Town'

        }
    },
}

class Player extends EventEmitter {
    constructor(socket) {
        super()
        this.socket = socket

        this.name = socket
        this.role = null

        this.on('player_role_update', this.roleUpdated)
        this.emit('player_init')
    }

    roleUpdated(player) {
        if(player === this) {
            this.socket.emit('role_update', this.role)
        }
    }
}

class Game extends EventEmitter {
    constructor(players, gameInfo) {
        super()

        if(players.length !== gameInfo.roles.length) {
            throw new Error("Invalid number of players to roles.")
        }

        this.players = players.map(p => {
            return new Player(p)
        })
        this.roles = gameInfo.roles
        this.gameStates = gameInfo.states

        this.initRoles()
        this.buildTasks()
        this.startGame()
    }

    initRoles() {
        var roles = this.roles.slice()
        console.log(this.roles, roles)

        shuffle(roles);
        this.players.forEach(player => {
            player.role = roles.shift()
            this.emit('player_role_update', player)
        })
    }

    buildTasks() {
        var uniqueRoles = new Set(this.roles)
        var uniqueTasks = new Set()
        uniqueRoles.forEach(uRole => {
            var tasks = roles[uRole].tasks
            tasks.forEach(task => {
                uniqueTasks.add(task)
            })
        })
        uniqueTasks.forEach(t => {
            new T(this)
        })
    }

    startGame() {
        if(this.state) {
            throw new Error("Game already started")
        }
        this.nextState()
    }

    nextState() {
        if(this.state) {
            this.emit(`${this.state}_ended`)
        }
        var newState = this.gameStates.indexOf(this.state) + 1
        newState = (newState > this.gameStates.length) ? 0 : newState
        this.state = this.gameStates[newState]

        var playersFinished = 0
        this.emit(`${this.state}_started`, () => {
            playersFinished += 1
            if(playersFinished === this.players.length) {
                this.nextState()
            }
        })
    }

    testMe() {
        this.players.forEach(p => {
            console.log(`I am ${p.name} and my role is ${p.role}`)
        })
    }
}


var game1 = ['werewolf', 'doctor', 'nobody','nobody','nobody','nobody']
var gameInfo = {
    roles: game1,
    states: ['night', 'day']
}

var game = new Game([1,2,3,4,5,6], gameInfo)
game.testMe()

