import http from 'http';
import WebSocket from 'ws';
import express from 'express';

const app = express();

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');
app.use('/public', express.static(__dirname + "/public"));
app.get('/', (req,res) => res.render('home'));
// catchall url : 사용자가 어떤 url을 입력하든 홈으로 리다이렉트 시킴
app.get('/*', (req,res) => res.redirect('/'));

const handleListen = () =>console.log(`Listening on http://localhost:3000`);


//express는 기본적으로 http 프로토콜만 다루기 때문에 웹소켓 프로토콜을 따로 연결시켜줌. 현재 방식은 http 서버 위에서 ws 서버가 돌아가는 방식. WebSocket.Server에는 옵션으로 서버를 넘겨줄 수 있으므로 여기에 http서버를 넘겨줌. 하지만 이건 옵션이기 때문에 ws 서버만 만들어도 됨.
//여기서 http 서버를 넘겨준 이유는 view, redirect, render 등을 사용하고 싶기 때문임!
const server = http.createServer(app);
const wss = new WebSocket.Server({server});

// socket for connected browser
const handleConnection = (socket) =>{
    console.log(socket);
}

wss.on("connection", handleConnection);

server.listen(3000, handleListen);