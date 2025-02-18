import axios from "axios"
import { useRenderData } from "streamlit-component-lib-react-hooks"

import React, { useRef, useEffect } from "react"
import Editor, { useMonaco } from "@monaco-editor/react"

let TabbyServerURL = "http://localhost:5000"

export default function MonacoEditor() {
  const renderData = useRenderData()

  if (renderData.args.tabby_server_url) {
    TabbyServerURL = renderData.args.tabby_server_url
  } else {
    TabbyServerURL = `${window.location.protocol}//${window.location.host}`
  }

  const monaco = useMonaco()
  useEffect(() => {
    if (!monaco) return
    monaco.languages.registerInlineCompletionsProvider(
      { pattern: "**" },
      new CompletionProvider(monaco)
    )
    monaco.editor.registerCommand(
      "acceptTabbyCompletion",
      (accessor, id, index) => {
        logAction(id, index, "select")
      }
    )
  }, [monaco])

  const editorRef = useRef(null)
  useEffect(() => {
    if (renderData.args.code && editorRef.current) {
      editorRef.current.getModel().setValue(renderData.args.code)
    }
  }, [renderData.args.code, editorRef])

  return (
    <div style={{ height: renderData.args.height }}>
      <Editor
        theme="vs-dark"
        defaultLanguage="python"
        onMount={(editor) => (editorRef.current = editor)}
      />
    </div>
  )
}

class CompletionProvider {
  constructor(monaco: Monaco) {
    this.monaco = monaco
    this.latestTimestamp = 0
  }

  async provideInlineCompletions(document, position, context, token) {
    const prompt = this.getPrompt(document, position)
    const emptyResponse = Promise.resolve({ items: [] })

    if (this.isNil(prompt)) {
      console.debug("Prompt is empty, skipping")
      return emptyResponse
    }

    const currentTimestamp = Date.now()
    this.latestTimestamp = currentTimestamp

    await this.sleep(500)
    if (this.pendingRequest) await this.pendingRequest
    if (currentTimestamp < this.latestTimestamp) {
      return emptyResponse
    }

    let response
    try {
      response = await this.callTabbyApi(currentTimestamp, prompt)
    } catch (err) {
      console.error("error", err)
      return emptyResponse
    }
    const hasSuffixParen = this.hasSuffixParen(document, position)
    const replaceRange = hasSuffixParen
      ? new this.monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column + 1
        )
      : new this.monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        )
    const items = this.toInlineCompletions(response.data, replaceRange)
    return Promise.resolve({ data: response.data, items })
  }

  handleItemDidShow(completions, item) {
    logAction(completions.data.id, item.choice.index, "view")
  }

  freeInlineCompletions() {}

  getPrompt(document, position) {
    const firstLine = Math.max(position.lineNumber - 120, 0)

    const range = new this.monaco.Range(
      firstLine,
      0,
      position.lineNumber,
      position.column
    )
    return document.getValueInRange(range)
  }

  isNil(value) {
    return value === undefined || value === null || value.length === 0
  }

  sleep(milliseconds) {
    return new Promise((r) => setTimeout(r, milliseconds))
  }

  async callTabbyApi(timestamp, prompt) {
    const request = (this.pendingRequest = axios.post(
      `${TabbyServerURL}/v1/completions`,
      {
        language: "python",
        prompt,
      }
    ))
    const response = await request
    this.pendingRequest = null
    return response
  }

  toInlineCompletions(value, range) {
    return (
      value.choices.map((choice) => ({
        range,
        text: choice.text,
        choice,
        command: {
          id: "acceptTabbyCompletion",
          arguments: [value.id, choice.index],
        },
      })) || []
    )
  }

  hasSuffixParen(document, position) {
    const suffix = document.getValueInRange(
      new this.monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column + 1
      )
    )
    return ")]}".indexOf(suffix) > -1
  }
}

function logAction(completion_id, choice_index, type) {
  axios.post(`${TabbyServerURL}/v1/events`, {
    type,
    completion_id,
    choice_index,
  })
}
