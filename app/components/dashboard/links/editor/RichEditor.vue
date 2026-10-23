<script setup lang="ts">
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from '@lucide/vue'
// undefined-charity fork: WYSIWYG editor for event page content. The editing
// surface uses the published page's styles; the HTML is sanitised again when
// the page is rendered (shared/utils/event-page-sanitize.ts).
import { mergeAttributes, Node } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { toast } from 'vue-sonner'
import { EVENT_FONT_SIZES, EVENT_FONTS, googleFontsHref } from '#shared/utils/event-page-fonts'
import { IMAGE_ALLOWED_TYPES, IMAGE_MAX_SIZE } from '#shared/utils/image'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: { toggleCallout: () => ReturnType }
  }
}

const props = defineProps<{
  slug: string
  accent: string
  background: string
  /** Taller surface, e.g. in the full-screen dialog. */
  tall?: boolean
}>()

const html = defineModel<string>({ required: true })

useHead({ link: [{ rel: 'stylesheet', href: googleFontsHref('', true) }] })

const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML: () => [{ tag: 'aside' }],
  renderHTML: ({ HTMLAttributes }) => ['aside', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0],
  addCommands() {
    return { toggleCallout: () => ({ commands }) => commands.toggleWrap(this.name) }
  },
})

const ButtonLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: element => element.getAttribute('class'),
        renderHTML: attributes => (attributes.class ? { class: attributes.class } : {}),
      },
    }
  },
}).configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: 'https',
  HTMLAttributes: { rel: null, target: null },
  isAllowedUri: (url, ctx) => url.startsWith('/') || ctx.defaultValidate(url),
})

const editor = useEditor({
  content: html.value,
  extensions: [
    StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }),
    ButtonLink,
    TextStyleKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Image.configure({ inline: false }),
    Callout,
  ],
  onUpdate: ({ editor }) => {
    html.value = editor.getHTML()
  },
})

// Keep the editor in step with the form, including content that arrives
// before the editor has finished mounting.
watch([html, editor], ([value, instance]) => {
  if (instance && value !== instance.getHTML())
    instance.commands.setContent(value, { emitUpdate: false })
})

const e = () => editor.value!.chain().focus()
const active = (name: string, attrs?: Record<string, unknown>) => editor.value?.isActive(name, attrs) ?? false

const blockType = computed({
  get: () => {
    for (const level of [1, 2, 3]) {
      if (active('heading', { level }))
        return `h${level}`
    }
    return 'p'
  },
  set: (value: string) => {
    if (value === 'p')
      e().setParagraph().run()
    else
      e().toggleHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 }).run()
  },
})

const fontFamily = computed({
  get: () => (editor.value?.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
  set: (value: string) => (value ? e().setFontFamily(value).run() : e().unsetFontFamily().run()),
})

const fontSize = computed({
  get: () => (editor.value?.getAttributes('textStyle').fontSize as string | undefined) ?? '',
  set: (value: string) => (value ? e().setFontSize(value).run() : e().unsetFontSize().run()),
})

const textColor = computed(() => (editor.value?.getAttributes('textStyle').color as string | undefined) ?? '#222222')
const highlightColor = computed(() => (editor.value?.getAttributes('textStyle').backgroundColor as string | undefined) ?? '#fff3a3')

// Link / button popover
const linkOpen = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const linkAsButton = ref(false)
const hasSelection = computed(() => editor.value ? !editor.value.state.selection.empty : false)

function openLink(asButton = false) {
  const attrs = editor.value?.getAttributes('link') ?? {}
  linkUrl.value = (attrs.href as string) || (asButton ? '/rsvp' : '')
  linkAsButton.value = asButton || attrs.class === 'button'
  linkText.value = ''
  linkOpen.value = true
}

function applyLink() {
  const href = linkUrl.value.trim()
  if (!href)
    return
  const attrs = { href, class: linkAsButton.value ? 'button' : null }
  if (active('link'))
    e().extendMarkRange('link').setLink(attrs as { href: string }).run()
  else if (hasSelection.value)
    e().setLink(attrs as { href: string }).run()
  else
    e().insertContent({ type: 'text', text: linkText.value.trim() || (linkAsButton.value ? 'Button' : href), marks: [{ type: 'link', attrs }] }).run()
  linkOpen.value = false
}

// Image upload
const imageInput = useTemplateRef<HTMLInputElement>('imageInput')
const uploading = ref(false)

async function onImagePicked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (imageInput.value)
    imageInput.value.value = ''
  if (!file)
    return
  if (!props.slug) {
    toast.error('Pick the short link first — images are stored under it.')
    return
  }
  if (!IMAGE_ALLOWED_TYPES.includes(file.type) || file.size > IMAGE_MAX_SIZE) {
    toast.error('Images must be JPEG, PNG, WebP or GIF, up to 5 MB.')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('slug', props.slug)
    const { url } = await useAPI<{ url: string }>('/api/upload/image', { method: 'POST', body: formData })
    e().setImage({ src: url, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }).run()
  }
  catch (error) {
    toast.error('Image upload failed', { description: error instanceof Error ? error.message : String(error) })
  }
  finally {
    uploading.value = false
  }
}

// Toolbar buttons must not take focus from the editor, or the next keystroke
// (e.g. typing after pressing Bold) goes nowhere.
function keepEditorFocus(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('button'))
    event.preventDefault()
}

const toolButton = 'inline-flex size-8 items-center justify-center rounded-md text-foreground hover:bg-muted aria-pressed:bg-muted aria-pressed:text-primary disabled:opacity-40'
const toolSelect = 'h-8 rounded-md border bg-background px-2 text-sm'
</script>

<template>
  <div class="overflow-hidden rounded-xl border">
    <div
      v-if="editor" class="
        sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b
        bg-background/95 p-1.5 backdrop-blur-sm
      " role="toolbar" aria-label="Formatting"
      @mousedown="keepEditorFocus"
    >
      <select v-model="blockType" :class="toolSelect" aria-label="Text style">
        <option value="p">
          Paragraph
        </option>
        <option value="h1">
          Title
        </option>
        <option value="h2">
          Heading
        </option>
        <option value="h3">
          Subheading
        </option>
      </select>
      <select v-model="fontFamily" :class="toolSelect" aria-label="Font">
        <option value="">
          Default font
        </option>
        <option v-for="font in EVENT_FONTS" :key="font.label" :value="font.family" :style="{ fontFamily: font.family }">
          {{ font.label }}
        </option>
      </select>
      <select v-model="fontSize" :class="toolSelect" aria-label="Font size">
        <option value="">
          Size
        </option>
        <option v-for="size in EVENT_FONT_SIZES" :key="size" :value="size">
          {{ size.replace('px', '') }}
        </option>
      </select>
      <span class="mx-0.5 h-6 w-px bg-border" />
      <button type="button" :class="toolButton" :aria-pressed="active('bold')" aria-label="Bold" @click="e().toggleBold().run()">
        <Bold
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="active('italic')" aria-label="Italic" @click="e().toggleItalic().run()">
        <Italic
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="active('underline')" aria-label="Underline" @click="e().toggleUnderline().run()">
        <Underline
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="active('strike')" aria-label="Strikethrough" @click="e().toggleStrike().run()">
        <Strikethrough
          class="size-4"
        />
      </button>
      <label :class="toolButton" class="relative cursor-pointer" title="Text color">
        <Palette class="size-4" :style="{ color: textColor }" />
        <input type="color" class="absolute inset-0 cursor-pointer opacity-0" :value="textColor" aria-label="Text color" @input="e().setColor(($event.target as HTMLInputElement).value).run()">
      </label>
      <label :class="toolButton" class="relative cursor-pointer" title="Highlight">
        <Highlighter class="size-4" />
        <input type="color" class="absolute inset-0 cursor-pointer opacity-0" :value="highlightColor" aria-label="Highlight color" @input="e().setBackgroundColor(($event.target as HTMLInputElement).value).run()">
      </label>
      <span class="mx-0.5 h-6 w-px bg-border" />
      <button type="button" :class="toolButton" :aria-pressed="editor.isActive({ textAlign: 'left' })" aria-label="Align left" @click="e().setTextAlign('left').run()">
        <AlignLeft
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="editor.isActive({ textAlign: 'center' })" aria-label="Align center" @click="e().setTextAlign('center').run()">
        <AlignCenter
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="editor.isActive({ textAlign: 'right' })" aria-label="Align right" @click="e().setTextAlign('right').run()">
        <AlignRight
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="active('bulletList')" aria-label="Bullet list" @click="e().toggleBulletList().run()">
        <List
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :aria-pressed="active('orderedList')" aria-label="Numbered list" @click="e().toggleOrderedList().run()">
        <ListOrdered
          class="size-4"
        />
      </button>
      <span class="mx-0.5 h-6 w-px bg-border" />
      <Popover v-model:open="linkOpen">
        <PopoverTrigger as-child>
          <button type="button" :class="toolButton" :aria-pressed="active('link')" aria-label="Link or button" title="Link or button" @click="openLink(false)">
            <Link2
              class="size-4"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent class="w-80 space-y-3" @open-auto-focus.prevent>
          <div class="space-y-1">
            <Label for="rich-link-url">URL</Label>
            <Input id="rich-link-url" v-model="linkUrl" placeholder="https://… or /rsvp" @keydown.enter.prevent="applyLink" />
            <p class="text-xs text-muted-foreground">
              <code>/rsvp</code>, <code>/donate</code>… point at this event's own links.
            </p>
          </div>
          <div v-if="!hasSelection && !active('link')" class="space-y-1">
            <Label for="rich-link-text">Text</Label>
            <Input id="rich-link-text" v-model="linkText" placeholder="RSVP" @keydown.enter.prevent="applyLink" />
          </div>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="linkAsButton" /> Show as a button
          </label>
          <div class="flex justify-between gap-2">
            <Button v-if="active('link')" type="button" variant="ghost" size="sm" @click="e().extendMarkRange('link').unsetLink().run(); linkOpen = false">
              <Unlink class="size-4" /> Remove
            </Button>
            <Button type="button" size="sm" class="ml-auto" @click="applyLink">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button" :class="toolButton" class="
          w-auto px-2 text-xs font-semibold
        " title="Insert a button" @click="openLink(true); linkOpen = true"
      >
        Button
      </button>
      <button type="button" :class="toolButton" :aria-pressed="active('callout')" aria-label="Highlighted box" title="Highlighted box" @click="e().toggleCallout().run()">
        <Quote
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :disabled="uploading || !slug" aria-label="Insert image" :title="slug ? 'Insert image' : 'Pick the short link first'" @click="imageInput?.click()">
        <Loader2
          v-if="uploading" class="
            size-4
            motion-safe:animate-spin
          "
        />
        <ImagePlus v-else class="size-4" />
      </button>
      <button type="button" :class="toolButton" aria-label="Divider" @click="e().setHorizontalRule().run()">
        <Minus
          class="size-4"
        />
      </button>
      <span class="mx-0.5 h-6 w-px bg-border" />
      <button type="button" :class="toolButton" aria-label="Clear formatting" title="Clear formatting" @click="e().unsetAllMarks().clearNodes().run()">
        <RemoveFormatting
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :disabled="!editor.can().undo()" aria-label="Undo" @click="e().undo().run()">
        <Undo2
          class="size-4"
        />
      </button>
      <button type="button" :class="toolButton" :disabled="!editor.can().redo()" aria-label="Redo" @click="e().redo().run()">
        <Redo2
          class="size-4"
        />
      </button>
      <input
        ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="
          hidden
        " @change="onImagePicked"
      >
    </div>

    <div class="event-surface" :data-bg="background" :style="{ '--accent': accent }">
      <div
        class="event-card" :class="tall ? 'min-h-[60svh]' : `
          max-h-[520px] overflow-y-auto
        `"
      >
        <EditorContent :editor="editor" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-surface {
  --text: #222;
  --heading: #111;
  --card: rgba(244, 244, 245, 0.9);
  padding: 20px;
  background: linear-gradient(180deg, #e3a3ee 0%, #f3b3dc 45%, #fcd9e6 100%);
}
.event-surface[data-bg='light'] {
  background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 35%, #fff), #fff);
}
.event-surface[data-bg='dark'] {
  --text: #e7e7ea;
  --heading: #fafafa;
  --card: rgba(30, 30, 36, 0.94);
  background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 45%, #111114), #111114);
}
.event-card {
  background: var(--card);
  color: var(--text);
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  padding: 24px 28px;
  font:
    16px/1.65 'Open Sans',
    system-ui,
    sans-serif;
}
.event-card :deep(.ProseMirror) {
  outline: none;
  min-height: 240px;
}
.event-card :deep(h1),
.event-card :deep(h2),
.event-card :deep(h3) {
  font-family: 'Times New Roman', Times, serif;
  color: var(--heading);
  line-height: 1.2;
}
.event-card :deep(h1) {
  font-size: 34px;
  font-weight: 700;
  margin: 0 0 8px;
}
.event-card :deep(h2) {
  font-size: 25px;
  font-weight: 400;
  margin: 28px 0 10px;
}
.event-card :deep(h3) {
  font-size: 20px;
  font-weight: 400;
  margin: 18px 0 8px;
}
.event-card :deep(p) {
  margin: 0 0 12px;
}
.event-card :deep(ul) {
  list-style: disc;
  padding-left: 24px;
  margin: 0 0 12px;
}
.event-card :deep(ol) {
  list-style: decimal;
  padding-left: 24px;
  margin: 0 0 12px;
}
.event-card :deep(li p) {
  margin: 4px 0;
}
.event-card :deep(a) {
  text-decoration: underline;
}
.event-card :deep(a.button) {
  display: inline-block;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 6px;
}
.event-card :deep(aside.callout) {
  margin: 20px 0;
  padding: 4px 20px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-radius: 10px;
}
.event-card :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  margin: 12px 0;
}
.event-card :deep(img.ProseMirror-selectednode) {
  outline: 3px solid var(--accent);
}
.event-card :deep(hr) {
  border: 0;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin: 24px 0;
}
</style>
