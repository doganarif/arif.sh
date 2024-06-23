---
title: "Real-Time WebSockets with Go and WebAssembly: A Complete Guide"
date: 2023-11-09
draft: false
---

WebAssembly with Go has always intrigued me, but finding comprehensive examples was challenging. After extensive research, I'm sharing my learnings and code examples for creating a real-time application using WebSockets and WebAssembly.

## Project Structure

```
.
├── main.go
├── wasm/
├── pkg/socket/
├── public/
└── Makefile
```

## Components

### 1. HTML (public/index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Go WASM Button Example</title>
    <script src="wasm_exec.js"></script>
    <style>
        #btn {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
    </style>
</head>
<body>
    <p id="text"></p>
    <button id="btn">Click me</button>
    <script>
        const go = new Go();
        WebAssembly.instantiateStreaming(fetch("main.wasm"), go.importObject).then((result) => {
            go.run(result.instance);
        });
        document.getElementById("btn").addEventListener("click", () => {
            onButtonClick();
        });
    </script>
</body>
</html>
```

### 2. WebSocket Service (pkg/socket/manage.go)

```go
package socket

import (
    "log"
    "math/rand"
    "net/http"
    "sync"
    "github.com/gorilla/websocket"
)

var websocketUpgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}

type NotifyEvent struct {
    client  *Client
    message string
}

type Client struct {
    id         uint32
    connection *websocket.Conn
    manager    *Manager
    writeChan  chan string
}

type Manager struct {
    clients    ClientList
    sync.RWMutex
    notifyChan chan NotifyEvent
}

type ClientList map[*Client]bool

func NewClient(conn *websocket.Conn, manager *Manager) *Client {
    return &Client{
        id:         rand.Uint32(),
        connection: conn,
        manager:    manager,
        writeChan:  make(chan string),
    }
}

func (c *Client) readMessages() {
    defer func() {
        c.manager.removeClient(c)
    }()
    for {
        messageType, payload, err := c.connection.ReadMessage()
        c.manager.notifyChan <- NotifyEvent{client: c, message: string(payload)}
        if err != nil {
            if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                log.Printf("error reading message: %v", err)
            }
            break
        }
        log.Println("MessageType: ", messageType)
        log.Println("Payload: ", string(payload))
    }
}

func (c *Client) writeMessages() {
    defer func() {
        c.manager.removeClient(c)
    }()
    for {
        select {
        case data := <-c.writeChan:
            c.connection.WriteMessage(websocket.TextMessage, []byte(data))
        }
    }
}

func NewManager() *Manager {
    m := &Manager{
        clients:    make(ClientList),
        notifyChan: make(chan NotifyEvent),
    }
    go m.notifyOtherClients()
    return m
}

func (m *Manager) otherClients(client *Client) []*Client {
    clientList := make([]*Client, 0)
    for c := range m.clients {
        if c.id != client.id {
            clientList = append(clientList, c)
        }
    }
    return clientList
}

func (m *Manager) notifyOtherClients() {
    for {
        select {
        case e := <-m.notifyChan:
            otherClients := m.otherClients(e.client)
            for _, c := range otherClients {
                c.writeChan <- e.message
            }
        }
    }
}

func (m *Manager) addClient(client *Client) {
    m.Lock()
    defer m.Unlock()
    m.clients[client] = true
}

func (m *Manager) removeClient(client *Client) {
    m.Lock()
    defer m.Unlock()
    if _, ok := m.clients[client]; ok {
        client.connection.Close()
        delete(m.clients, client)
    }
}

func (m *Manager) ServeWS(w http.ResponseWriter, r *http.Request) {
    log.Println("New Connection")
    conn, err := websocketUpgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Println(err)
        return
    }
    client := NewClient(conn, m)
    m.addClient(client)
    go client.readMessages()
    go client.writeMessages()
}
```

### 3. Main Server (main.go)

```go
package main

import (
    "log"
    "net/http"
    "github.com/doganarif/wasm/2/pkg/socket"
)

func main() {
    setupAPI()
    log.Fatal(http.ListenAndServe(":8080", nil))
}

func setupAPI() {
    manager := socket.NewManager()
    http.Handle("/", http.FileServer(http.Dir("./public")))
    http.Handle("/ws", http.HandlerFunc(manager.ServeWS))
}
```

### 4. WebAssembly Client (wasm/wasm.go)

```go
package main

import (
    "context"
    "fmt"
    "log"
    "syscall/js"
    "nhooyr.io/websocket"
)

type Conn struct {
    wsConn *websocket.Conn
}

func NewConn() *Conn {
    c, _, err := websocket.Dial(context.Background(), "ws://localhost:8080/ws", nil)
    if err != nil {
        fmt.Println(err, "ERROR")
    }
    return &Conn{
        wsConn: c,
    }
}

func main() {
    c := make(chan struct{}, 0)
    println("WASM Go Initialized")
    conn := NewConn()
    js.Global().Set("onButtonClick", onButtonClickFunc(conn))
    go conn.readMessage()
    <-c
}

func onButtonClickFunc(conn *Conn) js.Func {
    return js.FuncOf(func(this js.Value, args []js.Value) interface{} {
        println("Button Clicked!")
        err := conn.wsConn.Write(context.Background(), websocket.MessageText, []byte("HELLO"))
        if err != nil {
            log.Println("Error writing to WebSocket:", err)
        }
        return nil
    })
}

func (c *Conn) readMessage() {
    defer func() {
        c.wsConn.Close(websocket.StatusGoingAway, "BYE")
    }()
    for {
        messageType, payload, err := c.wsConn.Read(context.Background())
        if err != nil {
            log.Panicf(err.Error())
        }
        updateDOMContent(string(payload))
        log.Println("MessageType: ", messageType)
        log.Println("Payload: ", string(payload))
    }
}

func updateDOMContent(text string) {
    document := js.Global().Get("document")
    element := document.Call("getElementById", "text")
    element.Set("innerText", text)
}
```

### 5. Makefile

```makefile
.PHONY: build buildwasm run clean serve

WASM_DIR := ./wasm
PUBLIC_DIR := ./public
SERVER_FILE := main.go
WASM_SOURCE := $(WASM_DIR)/wasm.go
WASM_TARGET := $(PUBLIC_DIR)/main.wasm
GOOS := js
GOARCH := wasm

all: run

run: serve

serve: buildwasm
    go run $(SERVER_FILE)

buildwasm:
    GOOS=$(GOOS) GOARCH=$(GOARCH) go build -o $(WASM_TARGET) $(WASM_SOURCE)

clean:
    rm -f $(WASM_TARGET)
```

## How It Works

1. The WebSocket service manages client connections and message broadcasting.
2. The main server sets up routes for serving static files and WebSocket connections.
3. The WebAssembly client establishes a WebSocket connection, sends messages on button clicks, and updates the DOM with received messages.
4. The Makefile simplifies building and running the project.

## Running the Project

To run the project, simply use:

```
make serve
```

This will compile the WebAssembly binary and start the server.

## Conclusion

This project demonstrates a simple yet powerful way to create real-time web applications using Go and WebAssembly. It provides a foundation for more complex projects, showcasing the potential of this technology stack.

For the complete code and more details, visit the [GitHub repository](https://github.com/doganarif/go-wasm-socket).

Remember, the key to mastering new technologies is to start simple and build up. Happy coding!
