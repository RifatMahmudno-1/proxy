import net from 'node:net'

const SOCKS_CMD_CONNECT = 0x01
const SOCKS_VERSION = 0x05

const server = net.createServer(clientSocket => {
	// First step: negotiate authentication method
	clientSocket.once('data', data => {
		if (data[0] !== SOCKS_VERSION) {
			console.log('Invalid SOCKS version')
			clientSocket.end()
			return
		}
		// Respond with no authentication required (0x00)
		clientSocket.write(Buffer.from([SOCKS_VERSION, 0x00]))

		// Wait for the SOCKS request after the authentication handshake
		clientSocket.once('data', request => {
			if (request[1] !== SOCKS_CMD_CONNECT) {
				console.log('Only CONNECT command is supported')
				clientSocket.end()
				return
			}
			// Parse the request to extract the destination address and port
			const addrType = request[3]
			let destAddr = undefined
			let destPort = undefined
			if (addrType === 0x01) {
				// IPv4
				destAddr = request.subarray(4, 8).join('.')
				destPort = request.readUInt16BE(8)
			} else if (addrType === 0x03) {
				// Domain name
				let domainLength = request[4]
				destAddr = request.subarray(5, 5 + domainLength).toString()
				destPort = request.readUInt16BE(5 + domainLength)
			} else {
				console.log('Unsupported address type')
				clientSocket.end()
				return
			}

			console.log(`Connecting to ${destAddr}:${destPort}`)

			// Create a connection to the destination
			const remoteSocket = net.createConnection(destPort, destAddr, () => {
				// Send a successful response to the client
				clientSocket.write(Buffer.from([SOCKS_VERSION, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
				// Pipe data between client and remote server
				clientSocket.pipe(remoteSocket)
				remoteSocket.pipe(clientSocket)
			})

			remoteSocket.on('error', err => {
				console.error(`Failed to connect to ${destAddr}:${destPort}`, err)
				clientSocket.end()
			})
		})
	})

	clientSocket.on('error', err => {
		console.error('Client connection error:', err)
	})
})

server.listen(Number(process.env.PORT || 1080), process.env.HOST, () => console.log(`SOCKS5 proxy server listening on port ${process.env.PORT || 1080}`))
