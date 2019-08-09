const { crit2query: read_trial } = require("./crit2query");
const { Client } = require("pg");

const fs = require("fs");

// CONNECTING TO POSTGRES DATABASE
const client = new Client({
	user: "postgres",
	host: "localhost",
	password: "poland",
	database: "SynPUF",
	port: "5463"
});

client.connect(err => {
	if (err) {
		console.error(`connection error: \n\t`, err.stack);
	}
});

let beaut = {
	beatiful_query: "",
	beatiful_input: []
};

// MAKING QUERY AND INPUT JSON FOR API
client
	.query("select * from sam_input;")
	.then(res => {
		[beaut.beatiful_query, beaut.beatiful_input] = read_trial(res.rows);
		console.log(beaut)
		// make an https get request to the api
	})
	.catch(err => console.error(err.stack))
	.then(() => {
		client.end();
	});
