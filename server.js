const express = require('express');
const app = express();
const userRoutes=require('./routes/userRoutes')
const cors=require('cors');
const User = require('./models/User');
const Message = require('./models/Message');
//To recieve the data from frontend
app.use(express.urlencoded({extended:true}));
app.use(express.json());
//To allow front end and backend to communicate
app.use(cors());
const rooms = ['general','tech','anime','crypto','Competitive Programming'];
app.use('/users',userRoutes)
require('./connection')
const server = require('http').createServer(app);
const PORT=5001;
//Socket is used to communicate between server and the client here server can individually send the data
const io = require('socket.io')(server,{
    cors:{
        origin:"http://localhost:3000",
        methods:['GET', 'POST'],
    }
})

//here we collected the messages and collected the group of messages from each date
async function getLastMessagesFromRoom(room){
    let roomMessages = await Message.aggregate([
      {$match: {to: room}},
      {$group: {_id: '$date', messagesByDate: {$push: '$$ROOT'}}}
    ])
    //room messages are now generated
    return roomMessages;
  }
  

  //Sorting the room messages by date and arrange it in a particular format
  function sortRoomMessagesByDate(messages){
    return messages.sort(function(a, b){
      let date1 = a._id.split('/');
      let date2 = b._id.split('/');
      //Year month then day
      date1 = date1[2] + date1[0] + date1[1]
      date2 =  date2[2] + date2[0] + date2[1];
  
      return date1 < date2 ? -1 : 1
    })
  }
//socket connection
io.on('connection',(socket)=>{
   //For new user we are using io.emit new users
    socket.on('new-user',async()=>{
        const members=await User.find();
        //We used io.emit so that we emit for all users if we used socket.emit it would be of only 
        //one particular user
        io.emit('new-user',members)
    })
    //Once the message is sent it reflect back to the another room so 
    //to correct that we join new room and leave previous rooms
      socket.on('join-room', async(newRoom, previousRoom)=> {
    socket.join(newRoom);
    socket.leave(previousRoom);

    //Here we get last messages by date
    let roomMessages = await getLastMessagesFromRoom(newRoom);
    roomMessages = sortRoomMessagesByDate(roomMessages);
    socket.emit('room-messages', roomMessages)
  })
    socket.on('message-room',async(room,content,sender,time,date)=>{
      //New message
        const newMessage = await Message.create({content, from: sender, time, date, to: room});
        let roomMessages=await getLastMessagesFromRoom(room);
         //sending message to room messages
         io.to(room).emit('room-messages',roomMessages);
         //To send notification that there is message in the room to other  users   if they are not present in the room   
         socket.broadcast.emit('notifications',room);
    })
   
    app.delete('/logout',async(req,res)=>{
        try{ const {_id,newMessages}=req.body;
        const user=await User.findById(_id);
        user.status = "offline";
        user.newMessages=newMessages;
        await user.save();
        //To get the new memebers we refresh our updated members
        const members= await User.find();
        socket.broadcast.emit('new-user',members);
        res.status(200).send();
    }
    catch(e)
    {
        console.log(e);
        res.status(400).send();
    }
});


})
app.get('/rooms',(req,res)=>{
    res.json(rooms);
})
server.listen(PORT,()=>{
    console.log('Listening to port',PORT)
})