import React, {useEffect, useRef, useState} from 'react'
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import { io } from "socket.io-client";
import styles from "../styles/videoComponent.module.css"
import lobbyStyles from "../styles/lobby.module.css"
import IconButton from '@mui/material/IconButton';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import { useNavigate, useParams } from "react-router-dom";
import server from '../environment';

const server_url = server;
var connections = {};
const peerConfigConnections = {
    "iceServers": [
        { "urls": "stun:stun.l.google.com:19302"}
    ]
}

export default function VideoMeetComponent(){
   
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoRef = useRef();
    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState([]);
    let [audio, setAudio] = useState();
    let [screen, setScreen] = useState();
    let [showModal, setModal] = useState(true);
    let [screenAvailable, setScreenAvailable] = useState();
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState("");
    let [newMessages, setNewMessages] = useState();
    let [askForUsername, setAskUsername] = useState(true);
    let [username, setUsername] = useState("");
    const videoRef = useRef([])
    let [videos, setVideos] = useState([])
    const { url } = useParams();
    
    const getPermissions = async() => {
        try{
            const videoPermission = await navigator.mediaDevices.getUserMedia({video: true});
            if(videoPermission){
                setVideoAvailable(true);
            }else{
                setVideoAvailable(false);
            }
            const audioPermission = await navigator.mediaDevices.getUserMedia({audio: true});
            if(audioPermission){
                setAudioAvailable(true);
            }else{
                setAudioAvailable(false);
            }
            if(navigator.mediaDevices.getDisplayMedia){
                setScreenAvailable(true);
            }else{
                setScreenAvailable(false);
            }
            if(videoAvailable || audioAvailable){
                const userMediaStream = await navigator.mediaDevices.getUserMedia({video: videoAvailable, audio: audioAvailable});
                if(userMediaStream){
                    window.localStream = userMediaStream;
                    if(localVideoRef.current){
                        localVideoRef.current.srcObject = userMediaStream;
                    }
                }
            }
        }catch(err){
            console.log(err);
        }
    }
    useEffect(() => {
        getPermissions();
    }, [])

    let getUserMediaSuccess = (stream) => {
        try{
            window.localStream.getTracks().forEach(track => track.stop())
        }catch(e){
            console.log(e)
        }
        window.localStream = stream;
        localVideoRef.current.srcObject = stream;

        for(let id in connections){
            if(id === socketIdRef.current) continue;
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description)=>{
                connections[id].setLocalDescription(description)
                .then(()=>{
                    socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                })
                .catch(e => console.log(e))
            })
        }
        stream.getTracks().forEach(track => track.onended = () => {
            setVideo(false);
            setAudio(false);
            try{
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            }catch(e){ console.log(e)}
            let blackSlience = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSlience();
            localVideoRef.current.srcObject = window.localStream;
            for(let id in connections){
                connections[id].addStream(window.localStream)
                connections[id].createOffer().then((description)=> {
                    connections[id].setLocalDescription(description)
                    .then(()=>{
                        socketRef.current.emit("signal", id, JSON.stringify({"sdp": connections[id].localDescription}))
                    }).catch(e => console.log(e));
                })
            }
        })
    }

    let silence = () => {
        let ctx = new AudioContext()
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume()
        return Object.assign(dst.stream.getAudioTracks()[0], {enable: false})
    }

    let black = ({width=640, height=480} = {}) => {
        let canvas = Object.assign(document.createElement("canvas"), {width, height});
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], {enabled: false})
    }

    let getUserMedia = () => {
        if ((video && videoAvailable) || (audio && audioAvailable)) {
            navigator.mediaDevices.getUserMedia({video: video, audio: audio})
                .then(getUserMediaSuccess)
                .then((stream) => { })
                .catch((e) => console.log(e));
        } else {
            try {
                let tracks = localVideoRef.current.srcObject.getTracks();
                tracks.forEach(track => track.stop());
            } catch (e) {}
        }
    }

    useEffect(() => {
        if (video !== undefined && audio !== undefined) {
            getUserMedia();
        }
    }, [audio, video]);

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message);
        if(fromId !== socketIdRef.current){
            if(signal.sdp){
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if(signal.sdp.type === "offer"){
                        connections[fromId].createAnswer().then((description)=>{
                            connections[fromId].setLocalDescription(description).then(()=>{
                                socketRef.current.emit("signal", fromId, JSON.stringify({"sdp": connections[fromId].localDescription}))
                            }).catch(e => console.log(e))
                        }).catch(e=>console.log(e))
                    }
                }).catch(e=>console.log(e))
            }
            if(signal.ice){
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(e=>console.log(e));
            }
        }
    }

    let addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages)=>[
            ...prevMessages,
            {sender: sender, data: data}
        ]);
        if(socketIdSender !== socketIdRef.current){
            setNewMessages((prevMessages) => prevMessages+1)
        }
    }

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false})
        socketRef.current.on('signal', gotMessageFromServer)
        socketRef.current.on("connect", () => {
            socketRef.current.emit("join-call", window.location.href)
            socketIdRef.current = socketRef.current.id
            socketRef.current.on("chat-message", addMessage)
            socketRef.current.on("user-left", (id) => {
                setVideos((videos) => videos.filter((video)=>video.socketId !== id))
            })
            socketRef.current.on("user-joined", (id, clients) => {
                clients.forEach((socketListId)=> {
                    connections[socketListId] = new RTCPeerConnection(peerConfigConnections)
                    connections[socketListId].onicecandidate = (event) => {
                        if(event.candidate != null){
                            socketRef.current.emit("signal", socketListId, JSON.stringify({'ice':event.candidate}))
                        }
                    }
                    connections[socketListId].onaddstream = (event) => {
                        let videoExists = videoRef.current.find(video => video.socketId === socketListId);
                        if(videoExists){
                            setVideos(videos => {
                                const updatedVideos = videos.map(video => 
                                    video.socketId === socketListId ? { ...video, stream: event.stream} : video
                                );
                                videoRef.current = updatedVideos;
                                return updatedVideos;
                            })
                        }else{
                            let newVideo = {
                                socketId: socketListId,
                                stream: event.stream,
                                autoPlay: true,
                                playsinline: true
                            }
                            setVideos(videos=>{
                                const updatedVideos = [...videos, newVideo];
                                videoRef.current = updatedVideos
                                return updatedVideos;
                            });
                        }
                    };
                    if(window.localStream !== undefined && window.localStream !== null){
                        connections[socketListId].addStream(window.localStream);
                    }else{
                        let blackSlience = (...args) => new MediaStream([black(...args), silence()]);
                        window.localStream = blackSlience();
                        connections[socketListId].addStream(window.localStream);
                    }
                })
                if(id=== socketIdRef.current){
                    for(let id2 in connections){
                        if(id2 === socketIdRef.current) continue
                        try{
                            connections[id2].addStream(window.localStream)
                        }catch(e) {}
                        connections[id2].createOffer().then((description)=>{
                            connections[id2].setLocalDescription(description)
                                .then(()=>{
                                    socketRef.current.emit("signal", id2, JSON.stringify({"sdp": connections[id2].localDescription}))
                                })
                                .catch(e => console.log(e))
                        })
                    }
                }
            })
        })
    }

    let getMedia = () => {
        connectToSocketServer();
    }

    let routeTo = useNavigate();

    let connect = () => {
        setAskUsername(false);
        if(Array.isArray(video)){
            setVideo(videoAvailable);
        }
        if(audio === undefined){
            setAudio(audioAvailable);
        }
        getMedia();
    }

    let handleVideo = () => {
        if(window.localStream){
            setVideo(!video);
            window.localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
    }

    let handleAudio = () => {
        if(window.localStream){
            setAudio(!audio);
            window.localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
        }
    }

    let getDisplayMediaSucess = (stream) => {
        try{
            window.localStream.getTracks().forEach(track => track.stop())
        }catch(e) {console.log(e)}
        window.localStream = stream;
        localVideoRef.current.srcObject = stream;
        for(let id in connections){
            if(id==socketIdRef.current) continue;
            connections[id].addStream(window.localStream)
            connections[id].createOffer().then((description)=>{
                connections[id].setLocalDescription(description)
                .then(()=>{
                    socketRef.current.emit("signal", id, JSON.stringify({"sdp":connections[id].localDescription}))
                })
                .catch(e => console.log(e))
            })
        }
        stream.getTracks().forEach(track => track.onended = () => {
            setScreen(false);
            try{
                let tracks = localVideoRef.current.srcObject.getTracks()
                tracks.forEach(track => track.stop())
            }catch(e){ console.log(e)}
            let blackSlience = (...args) => new MediaStream([black(...args), silence()]);
            window.localStream = blackSlience();
            localVideoRef.current.srcObject = window.localStream;
            getUserMedia();
        })
    }

    let getDisplayMedia = () => {
        if(screen){
            if(navigator.mediaDevices.getDisplayMedia){
                navigator.mediaDevices.getDisplayMedia({video: true, audio:true})
                .then(getDisplayMediaSucess)
                .then((stream)=> {})
                .catch((e)=> console.log(e))
            }
        }
    }

    useEffect(()=>{
        if(screen!==undefined){
            getDisplayMedia();
        }
    }, [screen])

    let handleScreen = () => {
        setScreen(!screen);
    }

    let sendMessage = () => {
        socketRef.current.emit("chat-message", message, username);
        setMessage("");
    }

    let handleEndCall = () => {
        try{
            let tracks = localVideoRef.current.srcObject.getTracks();
            tracks.forEach(tracks=>tracks.stop())
        }catch(e){}
        routeTo("/home")
    }

    return(
        <div>
            {askForUsername === true ?

                /* ── LOBBY SECTION ── */
                <div className={lobbyStyles.lobbyContainer}>
                    <div className={lobbyStyles.lobbyContent}>

                        {/* Left: video preview */}
                        <div className={lobbyStyles.lobbyVideoSection}>
                            <video
                                className={lobbyStyles.lobbyVideo}
                                ref={localVideoRef}
                                autoPlay
                                muted
                            ></video>
                            <div className={lobbyStyles.lobbyVideoControls}>
                                <IconButton
                                    className={`${lobbyStyles.lobbyControlBtn} ${!video ? lobbyStyles.off : ""}`}
                                    onClick={handleVideo}
                                >
                                    {video ? <VideocamIcon/> : <VideocamOffIcon/>}
                                </IconButton>
                                <IconButton
                                    className={`${lobbyStyles.lobbyControlBtn} ${!audio ? lobbyStyles.off : ""}`}
                                    onClick={handleAudio}
                                >
                                    {audio ? <MicIcon/> : <MicOffIcon/>}
                                </IconButton>
                            </div>
                        </div>

                        {/* Right: info + join */}
                        <div className={lobbyStyles.lobbyInfoSection}>
                            <div>
                                <h1 className={lobbyStyles.lobbyTitle}>Ready to Join?</h1>
                                <p className={lobbyStyles.lobbySubtitle}>Check your camera and mic, then enter your name to join.</p>
                            </div>

                            <div className={lobbyStyles.lobbyRoomCode}>
                                <p>Room Code</p>
                                <span>{url}</span>
                            </div>

                            <div className={lobbyStyles.lobbyInputWrapper}>
                                <label>Your Name</label>
                                <TextField
                                    className={lobbyStyles.lobbyInput}
                                    id="outlined-basic"
                                    label="Enter your name"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    variant="outlined"
                                    InputProps={{ style: { color: 'white', borderRadius: '12px' } }}
                                    InputLabelProps={{ style: { color: 'rgba(255,255,255,0.5)' } }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                                            '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                                            '&.Mui-focused fieldset': { borderColor: '#a0c4ff' },
                                            backgroundColor: 'rgba(255,255,255,0.08)',
                                            borderRadius: '12px'
                                        }
                                    }}
                                />
                            </div>

                            <Button
                                className={lobbyStyles.lobbyConnectBtn}
                                variant="contained"
                                onClick={connect}
                                sx={{
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    background: 'linear-gradient(135deg, #512da8, #1976d2)',
                                    boxShadow: '0 4px 20px rgba(81, 45, 168, 0.4)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #673ab7, #1565c0)',
                                        boxShadow: '0 6px 25px rgba(81, 45, 168, 0.6)',
                                        transform: 'translateY(-2px)'
                                    }
                                }}
                            >
                                Join Meeting
                            </Button>
                        </div>
                    </div>
                </div>

            :
                /* ── MEETING ROOM SECTION (unchanged) ── */
                <div className={styles.meetVideoContainer}>
                    {showModal ? <div className={styles.chatRoom}>
                        <div className={styles.chatContainer}>
                            <h1>Chat</h1>
                            <div className={styles.chattingDisplay}>
                                {messages.length>0 ? messages.map((item, index)=>{
                                    return(
                                        <div style={{marginBottom:"20px"}} key={index}>
                                            <p style={{fontWeight:"bold"}}>{item.sender}</p>
                                            <p>{item.data}</p>
                                        </div>
                                    )
                                }): <p>No Messages Yet</p>}
                            </div>
                            <div className={styles.chattingArea}>
                                <TextField value={message} onChange={e => setMessage(e.target.value)} id="outlined-basic" label="Enter Your Chat" variant="outlined"
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                        color: 'white',
                                        borderRadius: '10px',
                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                                        },
                                        '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)' },
                                    }}
                                />
                                <Button variant='contained' onClick={sendMessage}>Send</Button>
                            </div>
                        </div>
                    </div> : <></>}
                    
                    <div className={styles.buttonContainers}>
                        <IconButton onClick={handleVideo} sx={{color:"white"}}>
                            {(video==true) ?<VideocamIcon/>: <VideocamOffIcon/>}
                        </IconButton>
                        <IconButton onClick={handleEndCall} sx={{color:"red"}}>
                            <CallEndIcon />
                        </IconButton>
                        <IconButton onClick={handleAudio} sx={{color:"white"}}>
                            {audio==true ?<MicIcon/> : <MicOffIcon/>}
                        </IconButton>
                        {screenAvailable==true ?
                        <IconButton onClick={handleScreen} sx={{color:"white"}}>
                            {screen==true ? <ScreenShareIcon/> :<StopScreenShareIcon/>}
                        </IconButton> : <></>}
                        <IconButton onClick={()=>setModal(!showModal)} sx={{color:"white"}}>
                            <ChatIcon/>
                        </IconButton>
                    </div>
                    <video className={styles.meetUserVideo} ref={localVideoRef} autoPlay muted></video>
                    <div className={styles.conferenceView}>
                    {videos.map((video)=>(
                        <div key={video.socketId}>
                            <video
                                data-socket={video.socketId}
                                ref={ref=>{
                                    if(ref && video.stream){
                                        ref.srcObject = video.stream;
                                    }
                                }}
                                autoPlay
                            ></video>
                        </div>
                    ))}
                    </div>
                </div>
            }
        </div>
    )
}