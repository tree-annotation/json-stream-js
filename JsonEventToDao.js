export const JsonEventToDao = () => {
  let ret = ''
  let depth = 0

  // note: what is lost in translation: top-level padding
  //   commas, colons

  const ws = (buf) => buf.join('')
  return {
    push: (event) => {
      // console.log(event)
      const {id, wsBuffer, buffer} = event

      if (['open object', 'open array'].includes(id)) {
        // ret += ws(wsBuffer)
        if (depth > 0) {
          ret += ws(wsBuffer) + '['
        }
        depth += 1
      } else if (['close object', 'close array'].includes(id)) {
        ret += ws(wsBuffer)
        depth -= 1
        if (depth > 0) {
          ret += ']'
        }
      } else if (id === 'string') {
        if (depth > 0) {
          ret += ws(wsBuffer) + '['
        }
        // todo: padding
        // console.log(buffer)
        ret += JSON.parse(buffer.join('')).replace(/(`|\[|\])/g, '`$1')

        if (depth > 0) {
          ret += ']'
        }
      } else if (['number', 'true', 'false', 'null'].includes(id)) {
        if (depth > 0) {
          ret += ws(wsBuffer) + '['
        }
        ret += buffer.join('')
        if (depth > 0) {
          ret += ']'
        }
      } else if (id === 'key') {
        ret += ws(wsBuffer)
        ret += JSON.parse(buffer.join('')).replace(/(`|\[|\])/g, '`$1')
      } else if (['comma', 'colon'].includes(id)) {
        ret += ws(wsBuffer)
      } else throw Error(`unrecognized event ${id}`)
    },
    end: (event) => {
      console.assert(event.id === 'end')
      // ret += ws(event.wsBuffer)
      // console.log('dtao', ret)
      return ret
    },
  }
}