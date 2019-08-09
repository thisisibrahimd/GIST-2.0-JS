const SVM = require("libsvm-js/asm");

exports.main = main;

// SECTION MAIN PROGRAM
function main(input, patient_data) {
	console.log("cleaning");
	let holy_results = clean_results(input, patient_data);
	console.log("calculating stats");
	calculations(input, holy_results);

	console.log("starting hypersurface process");
	let weights = hyper_surface(input, patient_data);
	let sum_weights = weights.reduce((prev, curr) => prev + curr, 0);

	let { elig_full, elig_passed } = meetAllCriteria(input, patient_data);
	let mgist = cal_mgist(sum_weights, elig_passed);
	let sgist = cal_sgist(input, weights, sum_weights, elig_full);

	return [input, holy_results, mgist, sgist];
}

function clean_results(inp, data) {
	let holyness = data.map((value, _index, _array) => {
		inp.forEach((value2, _index2, _array2) => {
			if (value[value2.column_name] == null) {
				value[value2.column_name] = -1;
			} else if (typeof value[value2.column_name] == typeof "") {
				value[value2.column_name] = parseFloat(value[value2.column_name]);
			} else if (value[value2.column_name] == value.p_id) {
				value[value2.column_name] = 1;
			}
		});
		return value;
	});
	return holyness;
}



function calculations(input, pt_data) {
	input.forEach((criteria, ind) => {
		col = criteria.column_name;
		if (col[0] == "m" || col[0] == "a") {
			let values = pt_data.map(row => {
				if (row[col] != -1) {
					return row[col];
				}
				return undefined;
			});
			values = values.filter(val => val != undefined);
			if (values[0] == undefined) {
				input[ind].mean = -1;
				input[ind].std = -1;
				input[ind].tally = -1;
				input[ind].w_min = -1;
				input[ind].w_max = -1;
			} else {
				input[ind].mean = cal_mean(values);
				input[ind].std = cal_std(values);
				input[ind].tally = cal_elig_prec(
					input[ind].criteria_min,
					input[ind].criteria_max,
					values
				);
				input[ind].w_min =
					(input[ind].criteria_min - input[ind].mean) / input[ind].std;
				input[ind].w_max =
					(input[ind].criteria_max - input[ind].mean) / input[ind].std;
			}
		}
	});
	return input;
}
function cal_mean(values) {
	let temp = values.reduce((acc, curr_val) => acc + curr_val) / values.length;
	return temp == null ? -1 : temp;
}
function cal_std(values) {
	var avg = cal_mean(values);
	if (avg == -1) {
		return -1;
	}
	var squareDiffs = values.map(val => {
		var diff = val - avg;
		var sqrDiff = diff * diff;
		return sqrDiff;
	});
	var avgSqrDiff = cal_mean(squareDiffs);
	var stdev = Math.sqrt(avgSqrDiff);
	return stdev;
}
function cal_elig_prec(min, max, values) {
	var tally = values.filter(val => min > val || val > max);
	if (tally == []) {
		return -1;
	}
	var percentage = tally.length / values.length;
	return percentage;
}




function hyper_surface(input, patient_values) {
	let features = [];
	let labels = [];
	patient_values.map(patient_row => {
		const cal_weights = (val, mean, std, weight) =>
			((val - mean) / std) * weight;
		let data = patient_row;
		let age;
		input.forEach(trait => {
			if (trait.column_name[0] == "m") {
				if (data[trait.column_name] == -1) {
					data[trait.column_name] =
						(trait.criteria_max - trait.criteria_min) / 2 + trait.criteria_min;
				}
				w_feat = cal_weights(
					data[trait.column_name],
					trait.mean,
					trait.std,
					trait.tally
				);
				data[trait.column_name] = w_feat;
			} else if (trait.column_name[0] == "a") {
				if (data[trait.column_name] == -1) {
					data[trait.column_name] =
						(trait.criteria_max - trait.criteria_min) / 2 + trait.criteria_min;
				}
				age = cal_weights(
					data[trait.column_name],
					trait.mean,
					trait.std,
					trait.tally
				);
			}
		});

		features.push(Object.values(data).slice(0, data.length - 1));
		labels.push(age);
	});
	const svm = new SVM({
		kernel: SVM.KERNEL_TYPES.RBF,
		gamma: 1,
		type: SVM.SVM_TYPES.EPSILON_SVR,
		cost: 1
	});
	console.log("training");
	svm.train(features, labels);
	console.log("hyper surfacing");
	const labels_pred = svm.predict(features);
	let weights = labels_pred.map(
		(pred, i) => 1 / (1 + Math.abs(pred - labels[i]))
	);
	return weights;
}




function meetAllCriteria(input, pat_vals) {
	let eligs = pat_vals.map(pat_row => cal_crit(input, pat_row));
	let elig_pass = eligs.map(bins =>
		bins.reduce((prev, curr) => prev + curr, 0) == bins.length ? 1 : 0
	);
	return { elig_full: eligs, elig_passed: elig_pass };
}
function cal_crit(input, pat_row) {
	// const cal_gen = (gen, elig) => (elig == gen ? 1 : 0);

	let calculated_criterias = input.map(crit => {
		let val = pat_row[crit.column_name];
		if (crit.column_name[0] == "g") {
			// let elig =
			// 	crit.criteria_elig_binary == null ? 0 : crit.criteria_elig_binary;
			return 1;
		} else if (crit.column_name[0] == "m" || crit.column_name[0] == "a") {
			// val =
			// 	val == -1
			// 		? (crit.criteria_max - crit.criteria_min) / 2 + crit.criteria_min
			// 		: pat_row[crit.column_name];
			return val >= crit.criteria_min && val <= crit.criteria_max ? 1 : 0;
		} else {
			// console.log(val, crit.criteria_elig_binary)
			return val == crit.criteria_elig_binary ||
				(crit.criteria_elig_binary == 0 && val == -1)
				? 1
				: 0;
			// return 1;
		}
	});
	return calculated_criterias;
}



function cal_mgist(sum_weights, eligs) {
	let sum_weighted_checks = eligs.reduce((prev, curr) => prev + curr, 0);
	return sum_weighted_checks / sum_weights;
}



function cal_sgist(input, weights, sum_weights, eligs) {
	let columns = input.map((_trait, i) => {
		const score =
			eligs
				.map((pat_row, j) => {
					return pat_row[i] * weights[j];
				})
				.reduce((prev, curr) => prev + curr, 0) / sum_weights;
		input[i].sg_score = score;
		return score;
	});

	return columns;
}
