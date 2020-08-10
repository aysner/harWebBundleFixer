'use strict';

const http = require('http');
const https = require('https');

const fs = require('fs');
const url = require('url');

function request_client(options, data) {
	let urlOptions = Object.assign({}, url.parse(options.uri));

	return new Promise((resolve, reject) => {
		let reqLib = https;

		if(urlOptions.protocol === 'http:') {
			reqLib = http;
		}

		const req = reqLib.request(urlOptions, (res) => {
			let body = '';
			res.on('data', (chunk) => (body += chunk.toString()));
			res.on('error', reject);
			res.on('end', () => {
				if (res.statusCode >= 200 && res.statusCode <= 299) {
					resolve({statusCode: res.statusCode, headers: res.headers, body: body});
				} else {
					reject('Request failed. status: ' + res.statusCode + ', body: ' + body);
				}
			});
		});
		req.on('error', reject);
		req.end();
	});
}

function fixHarFile() {
	const redownloaded_requests = [];
	const faild_requests = [];
	let empty_responses = [];
	let filename = '';
	let rawdata = null;
	let data = null;

	if(process.argv.length < 3) {
		console.error(`Missing filename.`);
		process.exit();
	}

	filename = process.argv[2];
	rawdata = fs.readFileSync(filename);
	data = JSON.parse(rawdata);

	function findEmptyResponses(requests) {
		const result = [];

		requests.forEach(function(request) {
			if (!request.response.content.text) {
				result.push(request);
			}
		});

		return result;
	}

	function fixCachedResponses(requests) {
		const result = [];
		let foundRequests = 0;

		requests.forEach(function(request) {
			if (request.response.status === 304) {
				console.log(`Fixing response code of ${request.request.url}`);
				foundRequests++;
				request.response.status = 200;
				request.response.statusText = '';
			}
		});

		requests.forEach(function(request) {
			if (request.response.status === 304) {
				console.log(`Fixing response code of ${request.request.url}`);
				foundRequests++;
				request.response.status == 200;
				request.response.statusText = '';
			}
		});

		if (foundRequests) {
			console.log(`Fixed ${foundRequests} request with cache status code 304.`);
		}
		return result;
	}

	function redownloadContent(request) {
		if (request.request.url.indexOf('data:') === 0) {
			return false; // Skip data links.
		}

		redownloaded_requests.push(
			request_client({uri: request.request.url})
				.then(responsedata => {
					request.response.content.text = Buffer.from(responsedata.body).toString('base64');
					request.response.content.encoding = "base64";
					request.response.content.size = request.response.content.text.length;
				})
				.catch((error) => {
					faild_requests.push({
						url: request.request.url,
						error: error
					})
				})
		);
	}

	function fixEmptyResponses(requests) {
		requests.forEach(function(request) {
			redownloadContent(request);
		});
	}

	function saveFile(filename, data) {
		const newFilename = filename.replace('.har', '') + '_new.har';

		console.log(`Saving result to ${newFilename}`);
		fs.writeFileSync(newFilename, JSON.stringify(data, null, 2));
	}

	(async () => {
		fixCachedResponses(data.log.entries);
		empty_responses = findEmptyResponses(data.log.entries);

		fixEmptyResponses(empty_responses);

		if (!empty_responses) {
			saveFile(filename, data);
		} else {
			console.log(`Trying to redownload ${empty_responses.length} requests.`);

			await Promise.all(redownloaded_requests).then(results => {
			
				if (faild_requests.length) {
					console.warn(`${faild_requests.length} requests failed to fetch.`);
					console.warn(faild_requests);
				} else {
					console.log(`All ${empty_responses.length} requests successful fetched.`);
				}
		
				saveFile(filename, data);
			});
		}
	})();
}

module.exports = fixHarFile.fixHarFile = fixHarFile;