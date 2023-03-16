import http from 'http';
import WebSocket from 'ws';
import {Server} from "socket.io";
import express from 'express';
import { instrument } from '@socket.io/admin-ui';

const app = express();

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');
app.use('/public', express.static(__dirname + "/public"));
app.get('/', (req,res) => res.render('home'));
// catchall url : 사용자가 어떤 url을 입력하든 홈으로 리다이렉트 시킴
app.get('/*', (req,res) => res.redirect('/'));

const handleListen = () =>console.log(`Listening on http://localhost:3000`);


//express는 기본적으로 http 프로토콜만 다루기 때문에 웹소켓 프로토콜을 따로 연결시켜줌. 현재 방식은 http 서버 위에서 ws 서버가 돌아가는 방식. WebSocket.Server에는 옵션으로 서버를 넘겨줄 수 있으므로 여기에 http서버를 넘겨줌. 하지만 이건 옵션이기 때문에 ws 서버만 만들어도 됨.m,.j.
//여기서 http 서버를 넘겨준 이유는 view, redirect, render 등을 사용하고 싶기 때문임!
const httpServer = http.createServer(app);

/* Socket IO 방식 */
const wsServer = new Server(httpServer, {
    cors: {
      origin: ["https://admin.socket.io"],
      credentials: true,
    },
  });
instrument(wsServer,{
    auth: false
});

//현재 개설된 방 리스트 리턴하는 함수
//어댑터의 sid와 room을 받아와서 foreach로 뱅글뱅글 돌면서
//sids에 없는 것들만 골라서 publicrooms 배열에 push
//왜? rooms는 현재 개설된 모든 방(public, private)을 가지고 있고
//sids는 현재 존재하는 소켓 아이디, 즉 private한 방을 가지고 있기 때문임.
const publicRooms = () => {
    const sids = wsServer.sockets.adapter.sids;
    const rooms = wsServer.sockets.adapter.rooms;

    const publicRooms = [];

    rooms.forEach((_,key) =>{
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    });
    
    return publicRooms;
}


const roomCount = (roomName) => {
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", socket=> {
    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit('welcome');
    });
    socket.on('offer', (offer, roomName) => {
        socket.to(roomName).emit('offer', offer);
    });
    socket.on('answer', (answer, roomName) => {
        socket.to(roomName).emit('answer', answer);
    });
    socket.on('ice', (ice, roomName)=>{
        socket.to(roomName).emit('ice', ice);
    });
    socket.on("disconnecting", () =>{
        socket.rooms.forEach(room => socket.to(room).emit('leaveRoom'));
    });
})


httpServer.listen(3000, handleListen);