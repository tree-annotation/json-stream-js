import {SymToJsonEvent, JsonEventType} from './SymToJsonEvent.js'


export const JsonEventToDao = () => {
  let ret = ''
  let depth = 0
  let mode = 'top'
  let isEmpty = [true]

  // note: what is lost in translation: top-level padding
  //   commas, colons

  let hexBuf = ''
  return {
    push: (event) => {
      // console.log(event)
      const {id} = event

      // todo: what about an array like [{}] or [[]]?
      // vs isEmpty
      // need a stack for arrays

      if (mode === 'top') {
        switch (id) {
          case JsonEventType.openString: {
            ret += '['
            mode = 'string'
            isEmpty[isEmpty.length - 1] = false
            break;
          } 
          case JsonEventType.openKey: {
            mode = 'string'
            isEmpty[isEmpty.length - 1] = false
            break
          } 
          case JsonEventType.openNumber: {
            ret += '['
            mode = 'number'
            isEmpty[isEmpty.length - 1] = false
            break
          } 
          case JsonEventType.openObject:
          case JsonEventType.openArray: {
            isEmpty[isEmpty.length - 1] = false
            ret += '['
            isEmpty.push(true)
            break
          } 
          case JsonEventType.closeObject: {
            if (isEmpty[isEmpty.length - 1]) ret += '{}`|'
            ret += ']'
            isEmpty.pop()
            break
          } 
          case JsonEventType.closeArray: {
            if (isEmpty[isEmpty.length - 1]) ret += '`[`]`|'
            ret += ']'
            isEmpty.pop()
            break
          }
          case JsonEventType.closeTrue: {
            ret += '[true`|]'
            isEmpty[isEmpty.length - 1] = false
            break
          } 
          case JsonEventType.closeFalse: {
            ret += '[false`|]'
            isEmpty[isEmpty.length - 1] = false
            break
          } 
          case JsonEventType.closeNull: {
            ret += '[null`|]'
            isEmpty[isEmpty.length - 1] = false
            break
          }
          case JsonEventType.colon:
          case JsonEventType.comma: {
            // todo?
            break
          } 
          case JsonEventType.whitespace: {
            // ret += event.sym
            break
          } 
          default: throw Error(`unrecognized event ${id}`)
        }
      } else if (mode === 'string') {
        switch (id) {
          case JsonEventType.buffer: {
            const {sym} = event
            if ('[]`'.includes(sym)) ret += '`' + sym
            else ret += sym
            break
          } 
          case JsonEventType.escape: {
            mode = 'escape'
            break
          } 
          case JsonEventType.openHex: {
            hexBuf = ''
            mode = 'hex'
            break
          } 
          case JsonEventType.closeString: {
            ret += ']'
            mode = 'top'
            break
          } 
          case JsonEventType.closeKey: {
            mode = 'top'
            break
          }
        }
      } else if (mode === 'escape') {
        if (id === JsonEventType.buffer) {
          const {sym} = event
          if (sym === 'n') ret += '\n'
          else if (sym === 't') ret += '\t'
          else if (sym === 'r') ret += '\r'
          else if (sym === 'b') ret += '\b'
          else if (sym === 'f') ret += '\f'
          else if (sym === '"') ret += '"'
          else if (sym === '\\') ret += '\\'
          else if (sym === '/') ret += '/'
          mode = 'string'
        }
      } else if (mode === 'hex') {
        if (id === JsonEventType.buffer) {
          hexBuf += event.sym
        } else if (id === JsonEventType.closeHex) {
          ret += Number.parseInt(hexBuf, 16)
          mode = 'string'
        }
      } else if (mode === 'number') {
        if (id === JsonEventType.buffer) {
          ret += event.sym
        } else if (id === JsonEventType.closeNumber) {
          ret += '`|]'
          mode = 'top'
        }
      } else {
        throw Error('unknown mode')
      }
    },
    end: (event) => {
      const r = ret
      ret = ''
      // console.assert(event.id === 'end')
      // ret += ws(event.wsBuffer)
      // console.log('dtao', ret)
      return r
    },
  }
}

const bsample = `{
     "firstName": "John",
     "lastName" : "Smith",
     "age"      : 25,
     "address"  :
     {
         "streetAddress": "21 2nd Street",
         "city"         : "New York",
         "state"        : "NY",
         "postalCode"   : "10021"
     },
     "phoneNumber":
     [
         {
           "type"  : "home",
           "number": "212 555-1234"
         },
         {
           "type"  : "fax",
           "number": "646 555-4567"
         }
     ]
 }`

const next = {push: () => {}, end: () => {}}
// const stream = SymToJsonEvent(next)
const stream = SymToJsonEvent(JsonEventToDao())

let lastRet
console.time('bench')
for (let i = 0; i < 100000; ++i) {
  for (let i = 0; i < bsample.length; ++i) {
    stream.push(bsample[i])
  }
  lastRet = stream.end()
  stream.reset()
}
console.timeEnd('bench')
console.log(lastRet)
// vs clarinet
// https://github.com/dscape/clarinet/blob/master/bench/results/sync/dscape-wikipedia.csv