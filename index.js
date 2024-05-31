const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand } = require('@aws-sdk/client-ecs')
require("dotenv").config();
const mongoose = require("mongoose");
const user = require("./models/User");
const project = require("./models/Project")
const { Server } = require('socket.io')
const Redis = require('ioredis')
const cors = require('cors');

const app = express()
app.use(cors());
const PORT =process.env.PORT || 9000
const subscriber = new Redis(process.env.redisp)
mongoose
  .connect(
    process.env.mogo_uri
  )
  .then(() => {

    console.log("Connected to database!");
    app.listen(PORT, () => console.log(`API Server Running..${PORT}`))
   
  })
  .catch(() => {
    console.log("Connection failed!");
  });

  const io = new Server({ cors: '*' })

  io.on('connection', socket => {
      socket.on('subscribe', channel => {
          socket.join(channel)
          socket.emit('message', `Joined ${channel}`)
      })
  })
  
  io.listen(9002, () => console.log('Socket Server 9002'))
  



const ecsClient = new ECSClient({
    region:process.env.region ,
    credentials: {
        accessKeyId: process.env.accessKeyId,
        secretAccessKey: process.env.secretAccessKey
    }
})



app.use(express.json())

app.post('/project', async (req, res) => {
    const { gitURL, slug,Email } = req.body
    const projectSlug = slug ? slug : generateSlug()

    const vemail = await user.findOne({email:Email})
    if(!vemail){
        
        return res.json({"message":"error user not found"})
        
    }
    console.log(vemail._id);

    // Spin the container
    const command = new RunTaskCommand({
        cluster: process.env.CLUSTER,
        taskDefinition:process.env.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: ['subnet-0eefa188b614c24a3', 'subnet-0201dabe45aa04f6c', 'subnet-036e0c7774527c39a'],
                securityGroups: ['sg-0b344488eca11d032']
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [
                        { name: 'GIT_REPOSITORY__URL', value: gitURL },
                        { name: 'PROJECT_ID', value: projectSlug }
                    ]
                }
            ]
        }
    })
    
    await ecsClient.send(command);
    
    await project.findOneAndUpdate(
        { user: vemail._id }, // Find the project associated with the user
        {
          $addToSet: { // Add to the projects array
            projects: { link: `http://${projectSlug}.dd-3.shop:8000` } // Add the new project link
          }
        },
        { upsert: true, new: true } // If project doesn't exist, create it, and return the new object
      );

    return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.dd-3.shop:8000` } })

})
async function initRedisSubscribe() {
  console.log('Subscribed to logs....')
  subscriber.psubscribe('logs:*')
  subscriber.on('pmessage', (pattern, channel, message) => {
      io.to(channel).emit('message', message)
  })
}


initRedisSubscribe()




//app.listen(PORT, () => console.log(`API Server Running..${PORT}`))