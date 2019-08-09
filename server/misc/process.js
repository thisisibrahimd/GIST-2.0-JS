const { Client } = require("pg");

const g = require("./gist");

exports.hey = function heyyp(data) {
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

	client
		.query(data.beatiful_query)
		.then(results => {
			const [teehee, patient_data, m, s] = g.main(
				data.beatiful_input,
				results.rows
			);
			// RETURN VALUES
			// const temp = JSON.stringify({
			// 	input: teehee,
			// 	pt_data: patient_data.slice(0, 5),
			// 	mg: m,
			// 	sg: s
			// });
			// fs.writeFileSync("hey.json", temp);
		})
		.catch(err => console.error(err.stack))
		.then(() => {
			client.end();
		});
};
