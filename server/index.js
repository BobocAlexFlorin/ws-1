import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

const app = express() 

app.use(express.static(path.join(__dirname, "public")))

const expressServer = app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})

const UsersState = {
    users: [],
    setUsers: function(newUsersArray) {
        this.users = newUsersArray
    }
}

const io = new Server(expressServer, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500", "http://127.0.0.1:5500"]
    }
})

io.on('connection', socket => {
    console.log(`User ${socket.id} connected`)

    // Dupa conexiune - numai catre user
    socket.emit('message', buildMsg(ADMIN, `Bine ai venit! User-ul tau este ${socket.id.substring(0,5)}`))

    socket.on('enterRoom', ({ name, room }) => {
        // sa iasa din fosta camera
        const prevRoom = getUser(socket.id)?.room
        if (prevRoom) {
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} a iesit din camera`))
        }

        const user = activateUser(socket.id, name, room)

        // Nu se poate da update la userii din camera revious pana cand se face leave
        if (prevRoom) {
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)
        })
    }
        socket.join(user.room)

        //mesaj catre user ul care a intrat in camera
        socket.emit('message', buildMsg(ADMIN, `Ai intrat in camera ${user.room}` ))

        //catre restul
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} a intrat in camera`))

        //Update la lista de useri
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)
        })

        // Cand un user se deconecteaza
        socket.on('disconnect', () => {
            const user = getUser(socket.id)
            userLeavesApp(socket.id)
            
            if(user) {
                io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} a iesit din camera`))

                io.to(user.room).emit('userList', {
                    users: getUsersInRoom(user.room)
                })

                io.emit('roomList', {
                    rooms: getAllActiveRoom()
                })
            }
        })

        //Update la lista camerei pentru toata lumea
        io.emit('roomList', {
            room: getAllActiveRoom()
        })
    })

    socket.on('message', ({ name, text}) => {
        const room = getUser(socket.id)?.room
        if (room){
            io.to(room).emit('message', buildMsg(name, text))
        }
    })


    // Asteptam dupa o activitate
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if(room){
            socket.broadcast.to(room).emit('activity', name)
        }
    })
})

function buildMsg(name, text) {
    return {
        name,
        text,
        time: new Intl.DateTimeFormat('ro-RO', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        }).format(new Date())
    }
}

// Functii pentru Useri

function activateUser(id, name, room) {
    const user = { id, name, room }
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])

    return user
}

function userLeavesApp(id) {
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room) {
    return UsersState.users.filter(user => user.room === room)
}

function getAllActiveRoom() {
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}