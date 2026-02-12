package server

import _ "embed"

// visualizerHTMLDefault is the bundled MCP App visualizer HTML.
// Rebuilt by `npm run build:apps` which outputs to pkg/server/apps/visualizer.html.
//
//go:embed apps/visualizer.html
var visualizerHTMLDefault string

// DefaultVisualizerHTML returns the embedded visualizer HTML.
// Use this with WithVisualizerHTML when creating a server:
//
//	server.New(config, server.WithVisualizerHTML(server.DefaultVisualizerHTML()))
func DefaultVisualizerHTML() string {
	return visualizerHTMLDefault
}
