const express    = require('express'),
      // cookie     = require('cookie-session'),
      session    = require('express-session'),
      passport   = require('passport'),
      cors       = require('cors'),
      app        = express()

require('dotenv').config({path: '.env'})

const LocalStrategy = require('passport-local').Strategy;
var GitHubStrategy = require('passport-github2').Strategy;
const { MongoClient, ObjectId } = require('mongodb')
const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@${process.env.HOST}`
const client = new MongoClient( uri )
let collection = null
let newUser = false

app.use( express.static( 'public' ) )
app.use( express.static( 'views'  ) )
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.session());
app.use(passport.initialize());
app.use(cors())
app.use( express.json() )

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "https://a3-avachadbourne.glitch.me/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    let username = profile.username
    setCollection(username)
    done(null, profile)
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

app.get('/login', cors(), function (req, res) {
    res.redirect('/auth/github')
  })

app.get('/auth/github', cors(), passport.authenticate('github', { session: false, scope: [ 'user:email' ] }));

app.get('/auth/github/callback', cors(),
  passport.authenticate('github', { failureRedirect: '/' }),
  function(req, res) {
    console.log("Redirecting to home")
    res.redirect('/main.html');
  });

async function run() {
  await client.connect()
  // collection = await client.db("sample_mflix").collection("number-data")

  // route to get all docs
  app.get("/docs", async (req, res) => {
    if (collection !== null) {
      const docs = await collection.find({}).toArray()
      res.json( docs )
    }
  })
}

app.use( (req,res,next) => {
  if( collection !== null ) {
    next()
  }else{
    res.status(503).send()
  }
})


app.post( '/refresh', cors(), async (req, res) => {
  const result = await collection.find({}).toArray()
  let resp = {new: false, data: result}
  if(newUser) {
    resp.new = true
  }
  newUser = false
  res.json(resp)
})

app.post( '/submit',cors(), async (req, res) => {
  let data = req.body
  console.log(data)

  let output = eval(data.val1 + data.op + data.val2) //Get correct answer
  let guess = false
  if(data.guess == output){ //If user guessed, evaluate that guess 
    guess = true
  } else if (data.guess == ''){
    guess = null
  }

  let newData = {val1: parseInt(data.val1), val2: parseInt(data.val2), op: data.op, output, guess}
  collection.insertOne(newData)
  const result = await collection.find({}).toArray()
  res.json(result)
})

app.post( '/remove', cors(), async (req, res) => {
  let data = req.body.id
  let query = { _id: ObjectId.createFromHexString(data)}
  let deletion = await collection.deleteOne(query)
  const result = await collection.find({}).toArray()
  res.json(result)
})

app.post( '/modify', cors(), async (req, res) => {
  let data = req.body
  let query = {_id: ObjectId.createFromHexString(data.id)}
  let oldData = await collection.findOne(query) //Get currently stored data in server
  let comboData = combineData(data, oldData) //Combine old and new data

  //If the user didnt assign a correct value, calculate it
  if (comboData.output == null || comboData.output == '') {
    comboData.output = eval(comboData.val1 + comboData.op + comboData.val2) 
  }
  
  collection.replaceOne(query, comboData) //Replace old server data 
  const result = await collection.find({}).toArray()
  res.json(result)
})

//Combine old and new data
function combineData (mod, old) {
  //New instance to store info
  let newData = {val1: null, val2: null, op: null, output: null, guess: null}
  if (mod.output != null) {
    //If user assigned a new answer, assign here
    newData.output = mod.output
  }

  //Get the most recent values of first value, second value, and the operator
  newData.val1 = pickData(mod, old, "val1")
  newData.val2 = pickData(mod, old, "val2")
  newData.op = pickData(mod, old, "op")

  return newData
}

//Pick the most recent data from old and new
function pickData (mod, old, valType) {
  //If data exists in most recent entry (mod), use that
  if (mod[valType] != null && mod[valType] != '') {
    return mod[valType]
  } else { //Otherwise default to old data
    return old[valType]
  }
}

async function setCollection (username) {
  let database = await client.db("sample_mflix")
  let userCollection = await database.collection(username)
  if (userCollection) {
    collection = userCollection
    newUser = false
  } else {
    database.createCollection(username)
    collection = await database.collection(username)
    console.log("New collection created for user " + username)
    newUser = true
  }
}

run()
app.listen(process.env.PORT)