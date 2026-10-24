package tv.majlis

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.Executors

/** A small HTTP/1.1 server: enough for the phone app and its JSON API on the home network. */
class HttpServer(private val port: Int, private val handler: (Request) -> Response) : Thread("majlis-http") {

    class Request(
        val method: String, val path: String, val query: Map<String, String>,
        val headers: Map<String, String>, val body: ByteArray, val local: Boolean
    ) {
        fun text(): String = if (body.isEmpty()) "{}" else body.toString(Charsets.UTF_8)
    }

    class Response(val code: Int, val type: String, val body: ByteArray) {
        companion object {
            fun json(s: String, code: Int = 200) = Response(code, "application/json; charset=utf-8", s.toByteArray())
        }
    }

    private val pool = Executors.newCachedThreadPool()
    @Volatile private var socket: ServerSocket? = null

    override fun run() {
        while (!isInterrupted) {
            try {
                val s = ServerSocket(port, 50, InetAddress.getByName("0.0.0.0")).also { socket = it }
                while (!s.isClosed) { val c = s.accept(); pool.execute { serve(c) } }
            } catch (e: Exception) {
                if (isInterrupted) return
                sleep(3000) // port busy or network change: try again
            }
        }
    }

    fun shutdown() { interrupt(); try { socket?.close() } catch (e: Exception) { }; pool.shutdownNow() }

    private fun serve(c: Socket) {
        c.use { sock ->
            try {
                sock.soTimeout = 20000
                val input = BufferedInputStream(sock.getInputStream())
                val head = readHead(input) ?: return
                val lines = head.split("\r\n")
                val parts = lines[0].split(" ")
                if (parts.size < 2) return
                val headers = HashMap<String, String>()
                for (l in lines.drop(1)) { val i = l.indexOf(':'); if (i > 0) headers[l.substring(0, i).trim().lowercase()] = l.substring(i + 1).trim() }
                val len = headers["content-length"]?.toIntOrNull() ?: 0
                if (len > 30_000_000) return
                val body = readBody(input, len)
                val target = parts[1]
                val q = target.indexOf('?')
                val path = URLDecoder.decode(if (q >= 0) target.substring(0, q) else target, "UTF-8")
                val query = HashMap<String, String>()
                if (q >= 0) for (kv in target.substring(q + 1).split('&')) {
                    val e = kv.indexOf('=')
                    if (e > 0) query[URLDecoder.decode(kv.substring(0, e), "UTF-8")] = URLDecoder.decode(kv.substring(e + 1), "UTF-8")
                }
                val local = sock.inetAddress.isLoopbackAddress
                val res = try { handler(Request(parts[0], path, query, headers, body, local)) }
                          catch (e: Exception) { Response.json("{\"error\":\"" + (e.message ?: "error").replace("\"", "'") + "\"}", 500) }
                val out = sock.getOutputStream()
                val h = StringBuilder()
                    .append("HTTP/1.1 ").append(res.code).append(if (res.code < 400) " OK" else " Error").append("\r\n")
                    .append("Content-Type: ").append(res.type).append("\r\n")
                    .append("Content-Length: ").append(res.body.size).append("\r\n")
                    .append("Access-Control-Allow-Origin: *\r\n")
                    .append("Access-Control-Allow-Methods: GET,POST,DELETE\r\n")
                    .append("Access-Control-Allow-Headers: Content-Type\r\n")
                    .append("Cache-Control: no-store\r\nConnection: close\r\n\r\n")
                out.write(h.toString().toByteArray())
                out.write(res.body)
                out.flush()
            } catch (e: Exception) { }
        }
    }

    private fun readHead(input: InputStream): String? {
        val buf = ByteArrayOutputStream()
        var last4 = 0
        while (buf.size() < 65536) {
            val b = input.read()
            if (b < 0) return null
            buf.write(b)
            last4 = (last4 shl 8) or b
            if (last4 == 0x0D0A0D0A) return buf.toString("UTF-8").trimEnd()
        }
        return null
    }

    private fun readBody(input: InputStream, len: Int): ByteArray {
        if (len <= 0) return ByteArray(0)
        val out = ByteArray(len)
        var read = 0
        while (read < len) { val n = input.read(out, read, len - read); if (n < 0) break; read += n }
        return if (read == len) out else out.copyOf(read)
    }
}
