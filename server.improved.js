const express    = require('express'),
      app        = express()

require('dotenv').config({path: '.env'})

//Base starting data
const appdata = [
  { "val1": 2, "val2": 2, "op": "+", "output" : 4, "guess" : null},
  { "val1": 3, "val2": 5, "op": "*", "output" : 15, "guess" : null},
  { "val1": 10, "val2": 5, "op": "-", "output" : 5, "guess" : null},
  { "val1": 36, "val2": 2, "op": "/", "output" : 18, "guess" : null},
]

app.use( express.static( 'public' ) )
app.use( express.static( 'views'  ) )
app.use( express.json() )


// const handleGet = function( request, response ) {
//   const filename = dir + request.url.slice( 1 ) 

//   if( request.url === "/" || request.url.includes("?")) {
//     //Weird bug was popping up here with extra GET requests being sent after data was modified
//     //No idea where the requests were coming from or why (I tried a lot of debugging on both client and server sides)
//     //To get any modification to work I had to hardcode in the "?" check
//     //Found this sunday night so I couldn't ask professor or TAs about it
//     sendFile( response, "public/index.html" )
//   }else{
//     sendFile( response, filename )
//   }
// }

//Handles new item
const handlePost = function( request, response ) {
  let dataString = ""

  request.on( "data", function( data ) {
      dataString += data 
  })

  request.on( "end", function() {
    let data = JSON.parse(dataString)
    console.log(data)

    let output = eval(data.val1 + data.op + data.val2) //Get correct answer
    let guess = false
    if(data.guess == output){ //If user guessed, evaluate that guess 
      guess = true
    } else if (data.guess == ''){
      guess = null
    }
    
    //Add data to table
    appdata.push({val1: parseInt(data.val1), val2: parseInt(data.val2), op: data.op, output, guess})
    //console.log(appdata)
    
    sendData(response) //Send data back to client
  })
}

app.post( '/refresh', (req, res) => {
  res.writeHead( 200, { 'Content-Type': 'application/json' })
  res.end( JSON.stringify( appdata ) )
})

app.post( '/submit', (req, res) => {
  let data = req.body
  console.log(data)

  let output = eval(data.val1 + data.op + data.val2) //Get correct answer
  let guess = false
  if(data.guess == output){ //If user guessed, evaluate that guess 
    guess = true
  } else if (data.guess == ''){
    guess = null
  }
  
  //Add data to table
  appdata.push({val1: parseInt(data.val1), val2: parseInt(data.val2), op: data.op, output, guess})
  res.writeHead( 200, { 'Content-Type': 'application/json' })
  res.end( JSON.stringify( appdata ) )
})

//Delete an item from the table
function deleteData (request, response) {
  let dataString = ""

  request.on( "data", function( data ) {
      dataString += data 
  })

  request.on("end", function(){
    data = JSON.parse(dataString) //Data is just the index of the entry to remove
    console.log("Index for deletion: " + data)
    let removed = appdata.splice(data, 1) //Remove from table
    console.log(removed)
    sendData(response) //Send data back to client
  } )
}

app.post( '/delete', (req, res) => {
  let data = req.body
  console.log("Index for deletion: " + data)
  let removed = appdata.splice(data, 1) //Remove from table
  console.log(removed)
  res.writeHead( 200, { 'Content-Type': 'application/json' })
  res.end( JSON.stringify( appdata ) )
})

//Modify data
function modData (request, response) {
  let dataString = ""

  request.on( "data", function( data ) {
      dataString += data 
  })

  request.on( "end", function() {
    let data = JSON.parse(dataString)
    //console.log(data)

    let oldData = appdata[data.index] //Get currently stored data in server
    let comboData = combineData(data, oldData) //Combine old and new data

    //If the user didnt assign a correct value, calculate it
    if (comboData.output == null || comboData.output == '') {
      comboData.output = eval(comboData.val1 + comboData.op + comboData.val2) 
    }
    
    appdata[data.index] = comboData //Replace old server data 
    sendData(response)
  })
}

app.post( '/modify', (req, res) => {
  let data = req.body
  let oldData = appdata[data.index] //Get currently stored data in server
  let comboData = combineData(data, oldData) //Combine old and new data

  //If the user didnt assign a correct value, calculate it
  if (comboData.output == null || comboData.output == '') {
    comboData.output = eval(comboData.val1 + comboData.op + comboData.val2) 
  }
  
  appdata[data.index] = comboData //Replace old server data 
  res.writeHead( 200, { 'Content-Type': 'application/json' })
  res.end( JSON.stringify( appdata ) )
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

app.listen(process.env.PORT)