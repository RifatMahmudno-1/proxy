import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

// Create the HTTP proxy server
const server = http.createServer((req, res) => {
	console.log(`HTTP request for: ${req.url}`)

	let parsedUrl = undefined
	try {
		parsedUrl = new URL(req.url.slice(1))
	} catch {
		parsedUrl = undefined
	}

	if (!parsedUrl) {
		res.writeHead(400, 'Invalid URL')
		res.end()
		return
	}
	if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
		res.writeHead(400, 'Invalid Protocol')
		res.end()
		return
	}

	const proxyRequest = (parsedUrl.protocol === 'http:' ? http : https)
		.request(
			req.url.slice(1),
			{
				method: req.method,
				headers: (() => {
					const h = { ...req.headers }
					delete h.host
					delete h.referer
					return h
				})()
			},
			proxyResponse => {
				res.writeHead(proxyResponse.statusCode, proxyResponse.headers)
				proxyResponse.pipe(res, { end: true })
			}
		)
		.on('error', err => {
			console.error('Error with proxy request:', err)
			res.writeHead(500)
			res.end('Internal Server Error')
		})

	// Forward the request to the target server
	req.pipe(proxyRequest, { end: true })
})

// Handle CONNECT method for HTTPS tunneling
server.on('connect', (req, clientSocket, head) => {
	console.log(`HTTPS CONNECT request for: ${req.url}`)

	const remoteSocket = net
		.connect(...req.url.split(':').reverse(), () => {
			// Send a 200 OK response to the client to indicate the tunnel is established
			clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

			// Pipe data between the client and the remote server
			remoteSocket.write(head)
			remoteSocket.pipe(clientSocket)
			clientSocket.pipe(remoteSocket)
		})
		.on('error', err => {
			console.error('Error with remote socket connection:', err)
			clientSocket.end()
		})

	clientSocket.on('error', err => console.error('Client socket error:', err))
})

server.listen(Number(process.env.PORT), process.env.HOST, () => console.log(`HTTP proxy server is running on port ${process.env.PORT}`))
