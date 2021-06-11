// note: perhaps {, }, [, ], :, , should go to buffer -- eatEmitValue?

// todo: make a good impl based on inner functions; after it's tested and benchmarked, inline all the functions and see if it improves things

const charCode0 = '0'.charCodeAt(0)
const charCode1 = '1'.charCodeAt(0)
const charCode9 = '9'.charCodeAt(0)
const charCodeLowerA = 'a'.charCodeAt(0)
const charCodeLowerF = 'f'.charCodeAt(0)
const charCodeUpperA = 'A'.charCodeAt(0)
const charCodeUpperF = 'F'.charCodeAt(0)

const Continue = {id: 'continue'}
const Mismatch = {id: 'mismatch'}

// todo: max buffer size; max prefix size; option to not buffer prefixes

// might be useful to have open string and close string events
// where you can decide to ignore the string -- this will cause the parser to drop all syms until close instead of buffering them -- saving memory; same for key?
// this could make sense to ignore values of certain keys
// perhaps a generic buffer switch could be sufficient + events for commas -- on each event you can toggle buffering by returning appropriate feedback; could even set event granularity, e.g. events for substrings, where you could search strings for some needle
// and/or could have a buffer full event/feedback

// todo: JsonEventType.true, ...

// SymToJson.make

export const SymToJsonEvent = (next) => {
  // todo: inline state vars
  const state = {
    choiceId: 'initial',
    isDone: false,
    wsBuffer: [],
    buffer: [],
  }
  const parents = ['top']
  let hexSeqIdx = 0

  const dumpState = () => JSON.stringify(state)


  const eat = (sym) => { state.buffer.push(sym) }
  // maybe this should return sth like {continue: true}
  const eatFork = (sym, choiceId) => {
    state.buffer.push(sym)
    state.choiceId = choiceId
    return Continue
  }
  const eatPrefix = (sym) => { state.wsBuffer.push(sym) }
  const emit = (id, choiceId) => {
    // todo: {type, prefix, buffer}
    const ret = next.push({
      id,
      wsBuffer: state.wsBuffer, // or join
      buffer: state.buffer, // or 
    })
    state.buffer = []
    state.wsBuffer = []
    state.choiceId = choiceId
    return ret
  }

  // todo? in most cases eat, emitvalue could be replaced with eatemitvalue
  const emitValue = (id) => {
    const parent = parents[parents.length - 1]
    emit(id, parent === 'top'? 'final': 'value*')
  }

  const isZeroNine = (sym) => {
    const code = sym.charCodeAt(0)
    return code >= charCode0 && code <= charCode9
  }

  const isOneNine = (sym) => {
    const code = sym.charCodeAt(0)
    return code >= charCode1 && code <= charCode9
  }

  const isWhitespace = (sym) => {
    return ' \r\n\t'.includes(sym)
  }

  // returning continue, next.push result, setting status ready for .end()
  // extracting repeated fragments
  // either make key a new kind of parent, entered on { and , (in object), and exited on :
  // or create a key flag

  const crash = (sym, msg) => {
    throw Error(`Expected ${msg}, got ${sym}`)
  }

  const value = (sym) => {
    if (sym === '{') {
      parents.push('object')
      parents.push('key')
      return emit('open object', '*key')
    }
    if (sym === '[') {
      parents.push('array')
      return emit('open array', '*value')
    } 
    if (sym === '"') return eatFork(sym, '"*')
    if (sym === 't') return eatFork(sym, 't*rue')
    if (sym === 'f') return eatFork(sym, 'f*alse')
    if (sym === 'n') return eatFork(sym, 'n*ull')
    if (sym === '-') return eatFork(sym, '-*')
    if (sym === '0') return eatFork(sym, '0*')
    
    if (isOneNine(sym)) return eatFork(sym, '1-9*')
    if (isWhitespace(sym)) return eatPrefix(sym)

    // return {id: 'error', message: `Unexpected symbol in value ${sym}`}
    return Mismatch
  }
  const fraction = (sym) => {
    if (sym === '.') return eatFork(sym, '0-9.*')
    return exponent(sym)
  }
  const exponent = (sym) => {
    if ('eE'.includes(sym)) return eatFork(sym, 'exp*')
    return number(sym)
  }
  const number = (sym) => {
    // we assume here that sym is a non-numeric symbol that terminates the number
    // note: eatemitvalue is not suitable here
    emitValue('number')
    // the terminating symbol is part of what comes after the number -- essentially a space or a comma
    // let the standard flow handle that
    return self.push(sym)
  }

  const closeParent = (sym) => {
    const parent = parents[parents.length - 1]

    if (parent === 'object' && sym === '}') {
      parents.pop()
      // could eatEmitValue just as well
      emitValue('close object')
    } 
    else if (parent === 'array' && sym === ']') {
      parents.pop()
      // could eatEmitValue just as well
      emitValue('close array')
    } 
    else {
      crash(sym, `whitespace or comma or ${parent} close`)
    }
  }

  const self = {
    push: (sym) => {
      const {isDone, choiceId} = state
      if (isDone) {
        throw Error(`PUSH: Matcher already completed! ${dumpState()}`)
      }

      // todo: maybe replace the if-elses with a map
      // todo: set isDone before the end (on match or mismatch)

      // todo: prioritize? order by most often hit branches first
      // todo: ?initial -> *value or top
      if (choiceId === 'initial') {
        if (value(sym) === Mismatch) {
          throw Error(`Unexpected top-level symbol ${sym}`)
        }
      } 
      else if (choiceId === 'final') {
        // todo: could tune the parser so it accepts infinite stream of space-separated JSON values
        if (isWhitespace(sym)) eatPrefix(sym)
        else {
          throw Error(`Unexpected non-whitespace after top-level value: ${sym}`)
        }
      } 
      else if (choiceId === '"*') {
        if (sym === '"') {
          const parent = parents[parents.length - 1]
          eat(sym)
          if (parent === 'key') emit('key', 'key*')
          else emitValue('string')
        } 
        else if (sym === '\\') eatFork(sym, '\\*')
        else {
          const code = sym.charCodeAt(0)
          if (code >= 0x0020 && code <= 0x10ffff) { eat(sym) } 
          else {
            throw Error(`Unexpected control character: ${code}`)
          }
        }
      } 
      else if (choiceId === '\\*') {
        if ('"\\/bfnrt'.includes(sym)) eatFork(sym, '"*')
        else if (sym === 'u') eatFork(sym, '\\u*')
        else {
          // todo: error: invalid escape
          throw Error(`Invalid escape character: ${sym}`)
        }
      } 
      else if (choiceId === '\\u*') {
        // '0123456789abcdefABCDEF'.includes(sym)
        const code = sym.charCodeAt(0)
        if (
          (code >= charCode0 && code <= charCode9) ||
          (code >= charCodeLowerA && code <= charCodeLowerF) ||
          (code >= charCodeUpperA && code <= charCodeUpperF)
        ) {
          if (hexSeqIdx < 3) {
            hexSeqIdx += 1
            eat(sym)
          } else {
            hexSeqIdx = 0
            eatFork(sym, '"*')
          }
        } else {
          // todo: error: invalid hex escape
          throw Error(`Invalid hexadecimal escape character: ${sym}`)
        }
      } 
      else if (choiceId === '-*') {
        if (sym === '0') eatFork(sym, '0*')
        else {
          // todo: extract ~ afterMinus
          if (isOneNine(sym)) eatFork(sym, '1-9*')
          else {
            // todo: throw: invalid after -
            throw Error(`Expected 0-9, got ${sym}`)
          }
        }
      } 
      else if (choiceId === '0*') return fraction(sym)
      else if (choiceId === '1-9*') {
        // todo: extract code0-9, maybe code1-9
        if (isZeroNine(sym)) eatFork(sym, '1-90-9*')
        else return fraction(sym)
      } 
      else if (choiceId === '0-9.*') {
        // todo: extract
        if (isZeroNine(sym)) eatFork(sym, '0-9.0-9*')
        else {
          throw Error(`expected 0-9, got ${sym}`)
        }
      } 
      else if (choiceId === 'exp*') {
        if ('+-'.includes(sym)) eatFork(sym, 'exp+-*')
        else {
          // todo: extract
          if (isZeroNine(sym)) eatFork(sym, 'exp+-0-9')
          else throw Error(`Expected +-0..9, got ${sym}`)
        }
      } 
      else if (choiceId === '1-90-9*') {
        // todo?: extract digit loop
        if (isZeroNine(sym)) eat(sym)
        else return fraction(sym)
      } 
      else if (choiceId === '0-9.0-9*') {
        // todo?: extract digit loop
        if (isZeroNine(sym)) eat(sym)
        else return exponent(sym)
      } 
      else if (choiceId === 'exp+-*') {
        // todo charcode ><
        if (isZeroNine(sym)) eatFork(sym, 'exp+-0-9')
        else {
          throw Error(`Expected digit, got ${sym}`)
        }
      } 
      else if (choiceId === 'exp+-0-9') {
        // todo?: extract digit loop
        if (isZeroNine(sym)) eat(sym)
        else return number(sym)
      } 
      else if (choiceId === 't*rue') {
        if (sym === 'r') eatFork(sym, 'tr*ue')
        else throw Error(`expected t[r]ue, got t[${sym}]...`)
      } 
      else if (choiceId === 'tr*ue') {
        // todo: error reporting
        if (sym === 'u') eatFork(sym, 'tru*e')
        else throw Error(`expected tr[u]e, got tr[${sym}]...`)
      } 
      else if (choiceId === 'tru*e') {
        // todo: error reporting
        if (sym === 'e') {
          eat(sym)
          emitValue('true')
        }
        else throw Error(`expected tru[e], got tru[${sym}]...`)
      } 
      else if (choiceId === 'f*alse') {
        // todo: error reporting
        if (sym === 'a') eatFork(sym, 'fa*lse')
        else throw Error(`expected f[a]lse, got f[${sym}]...`)
      } 
      else if (choiceId === 'fa*lse') {
        // todo: error reporting
        if (sym === 'l') eatFork(sym, 'fal*se')
        else throw Error(`expected fa[l]se, got fa[${sym}]...`)
      } 
      else if (choiceId === 'fal*se') {
        // todo: error reporting
        if (sym === 's') eatFork(sym, 'fals*e')
        else throw Error(`expected fal[s]e, got fal[${sym}]...`)
      } 
      else if (choiceId === 'fals*e') {
        // todo: error reporting
        if (sym === 'e') {
          eat(sym)
          emitValue('false')
        }
        else throw Error(`expected fals[e], got fals[${sym}]...`)
      } 
      else if (choiceId === 'n*ull') {
        // todo: error reporting
        if (sym === 'u') eatFork(sym, 'nu*ll')
        else throw Error(`expected n[u]ll, got n[${sym}]...`)
      } 
      else if (choiceId === 'nu*ll') {
        // todo: error reporting
        if (sym === 'l') eatFork(sym, 'nul*l')
        else throw Error(`expected nu[l]l, got nu[${sym}]...`)
      } 
      else if (choiceId === 'nul*l') {
        // todo: error reporting
        if (sym === 'l') {
          eat(sym)
          emitValue('null')
        }
        else throw Error(`expected nul[l], got nul[${sym}]...`)
      } 
      else if (choiceId === '*value') {
        if (value(sym) === Mismatch) closeParent(sym)
      } 
      else if (choiceId === 'value*') {
        // todo: accept whitespace, comma, ] if current parent is array, } if current parent is object

        if (sym === ',') {
          const parent = parents[parents.length - 1]

          if (parent === 'object') {
            parents.push('key')
            emit('comma', '*key')
          } 
          else if (parent === 'array') emit('comma', '*value')
          else throw Error(`Unexpected parent ${parent}`)
        }
        else if (isWhitespace(sym)) eatPrefix(sym)
        else closeParent(sym)
      } 
      else if (choiceId === '*key') {
        if (sym === '"') eatFork(sym, '"*')
        else if (sym === '}') {
          // const parent = parents[parents.length - 1]
          // console.assert(parent === 'key')
          parents.pop()
          parents.pop()
          // eatemitvalue would work here too
          emitValue('close object')
        } 
        else if (isWhitespace(sym)) eatPrefix(sym)
        else {
          crash(sym, `whitespace or " or object close`)
        }
      } 
      else if (choiceId === 'key*') {
        // whitespace or : or crash
        // todo: emit key either on +close string or :
        // todo: transition from string close to this choiceId if choiceId before string open was *key
        if (sym === ':') {
          // console.assert(parents[parents.length - 1] === 'key')
          parents.pop()
          emit('colon', '*value')
        } 
        else if (isWhitespace(sym)) eatPrefix(sym)
        else {
          throw Error(`Expected : or whitespace, got ${sym}`)
        }
      }

      return Continue
    },
    end: () => {
      // todo: include final wsBuffer in the end event
      const {isDone, choiceId} = state
      if (isDone) {
        throw Error(`END: Matcher already completed! ${dumpState()}`)
      }

      if (choiceId === 'final') {
        state.isDone = true
        // todo? or push event, then call next.end() w/o args
        return next.end({
          id: 'end',
          wsBuffer: state.wsBuffer,
        })
      } else if (['exp+-0-9', '1-9*', '1-90-9*', '0-9.0-9*', '0*'].includes(choiceId)) {
        state.isDone = true
        // eatemitvalue would not work here
        emitValue('number')
        return next.end({
          id: 'end',
          wsBuffer: state.wsBuffer,
        })
      } else {
        // todo: error
        throw Error(`todo: invalid end state ${dumpState()}`)
      }
    },
  }

  return self
}