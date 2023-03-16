const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const muteBtnIcon = document.querySelector('#mute i');
const cameraBtn = document.getElementById("camera");
const cameraBtnIcon = document.querySelector('#camera i');
const camerasSelect = document.getElementById('cameras');

const welcome = document.getElementById('welcome');
const userName = document.getElementById('nickname');
const userNameForm = userName.querySelector('#nickForm');
const call = document.getElementById('call');
const welcomeForm  = welcome.querySelector('form');

const peerFace = document.getElementById("peerFace");

//stream : 비디오와 오디오가 결합된 것.
let myStream; 
let muted = false;
let cameraOff = false;
let roomName = '';
let myPeerConnection; 
let myDataChannel; 
let nickname;


userName.hidden = true;
peerFace.hidden = true;
call.hidden = true;

//카메라 리스트를 받아오는 함수
const getCameras = async () => {
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label){
                option.selected = true;
            }
            camerasSelect.appendChild(option);
        })
    }catch(e){
        console.log(e);
    }
}


const handleCameraChange = async () => {
    await getMedia(camerasSelect.value);
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find(sender=>sender.track.kind==="video");
        videoSender.replaceTrack(videoTrack);
    }
}

const getMedia = async (deviceId) => {
    const initialConstrains = {
        audio: true,
        video: {facingMode: "user"},
    };
    const cameraConstrains = {
        audio: true,
        video: {deviceId: {exact: deviceId}},
    };
    try{
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstrains : initialConstrains);
        myFace.srcObject = myStream;
        if(!deviceId){
            await getCameras();
        }
    } catch(e){
        console.log(e);
    }
}

const handleMuteBtnClick = () => {
    myStream.getAudioTracks().forEach((track)=>(track.enabled = !track.enabled));
    if(!muted){
        muteBtnIcon.classList.remove('fa-volume-xmark', 'on');
        muteBtnIcon.classList.add('fa-volume-high');
        muted = true;
    }
    else{
        muteBtnIcon.classList.remove('fa-volume-high');
        muteBtnIcon.classList.add('fa-volume-xmark', 'on');
        muted = false;
    }
}

const handleCameraBtnClick = () => {
    myStream.getVideoTracks().forEach((track)=>(track.enabled = !track.enabled));
    if(cameraOff){
        cameraBtnIcon.classList.remove('fa-video');
        cameraBtnIcon.classList.add('fa-video-slash', 'on');
        cameraOff = false;
    }
    else{
        cameraBtnIcon.classList.remove('fa-video-slash', 'on');
        cameraBtnIcon.classList.add('fa-video');
        cameraOff = true;
    }
}

muteBtn.addEventListener("click", handleMuteBtnClick);
cameraBtn.addEventListener("click", handleCameraBtnClick);
camerasSelect.addEventListener('input', handleCameraChange);

const startMedia = async () => {
    userName.hidden = true;
    call.hidden = false;
    const roomTitle = document.getElementById('roomTitle');
    roomTitle.innerText = `Room : ${roomName}`;
    const msgForm = document.getElementById('chatForm');
    msgForm.addEventListener('submit', handleMessageSubmit);
    await getMedia();
    makeConnection();
}

const handleWelcomeSubmit = async (event) => {
    event.preventDefault();
    const input = welcomeForm.querySelector('input');
    roomName = input.value;
    welcome.hidden = true;
    userName.hidden = false;
    userNameForm.addEventListener('submit', handleNickname)
    input.value = '';
}


welcomeForm.addEventListener('submit', handleWelcomeSubmit);


/* 채팅 관련 코드 */
const handleMessageSubmit = (event) =>{
    event.preventDefault();
    const input = call.querySelector('#chatForm input');
    console.log(myDataChannel);
    console.log(`${nickname} : ${input.value}`);
    myDataChannel.send(`${nickname} : ${input.value}`);
    addMessage(`나 : ${input.value}`, 'self');
    input.value = '';
}

const addMessage = (msg, type) => {
    const msgList = call.querySelector('#chat ul');
    const li = document.createElement('li');
    li.innerText = msg;
    switch (type){
        case 'self':
            li.classList.add('message-self');
            break;
        case 'peer':
            li.classList.add('message-peer');
            break;
    }
    msgList.appendChild(li);
}


const handleNickname = async (event) => {
    event.preventDefault();
    const input = userNameForm.querySelector('#nickForm input');
    nickname = input.value;
    await startMedia();
    socket.emit('join_room', roomName);
    input.value = '';
}


/* socket code */
// 방 만든 쪽에서 돌아가는 코드. 1->2->3 순으로 진행됨.
//1)
socket.on('welcome', async () => {
    console.log('welcome!');
    myDataChannel = myPeerConnection.createDataChannel("chat");
    console.log(`myDataChannel : ${myDataChannel}`);
    myDataChannel.addEventListener('message', (event)=>{
        addMessage(event.data, 'peer');
    });
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, roomName);
});

//3)
socket.on('answer', async(answer) => {
    myPeerConnection.setRemoteDescription(answer);
});

// 만들어진 방에 접속하는 브라우저에서 돌아가는 코드
//2)
socket.on('offer', async(offer) => {
    myPeerConnection.addEventListener('datachannel', (event)=>{
        console.log(`event channel : ${event.channel}`);
        myDataChannel = event.channel;
        myDataChannel.addEventListener('message', (event)=>{
            addMessage(event.data, 'peer');
        });
    });
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit('answer', answer, roomName);
});


socket.on('ice', ice =>{
    myPeerConnection.addIceCandidate(ice);
});


/* RTC code */
const makeConnection = () => {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
              urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
              ],
            },
          ],
    });
    myPeerConnection.addEventListener('icecandidate', handleIce);
    myPeerConnection.addEventListener('track', handleTrack);
    if(myStream){
        myStream.getTracks().forEach((track) => myPeerConnection.addTrack(track, myStream));
    }  
    console.log(myPeerConnection);
}


const handleIce = (data) =>{
    peerFace.hidden = false;
    socket.emit('ice', data.candidate, roomName);
}

const handleTrack = (data) => {
    peerFace.srcObject = data.streams[0];
}


