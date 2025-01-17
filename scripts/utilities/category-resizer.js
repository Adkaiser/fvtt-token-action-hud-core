import { Utils } from './utils.js'

export class CategoryResizer {
    direction = null
    minCols = 3
    isCustomWidth = false
    settings = null
    spacing = 10

    /**
     * Resize the groups element
     * @param {ActionHandler} actionHandler The actionHandler class
     * @param {object} groupElement         The group element
     * @param {string} autoDirection        The direction the HUD will expand
     * @param {boolean} gridModuleSetting   The grid module setting
     */
    async resizeCategory (actionHandler, groupElement, autoDirection, gridModuleSetting) {
        // Exit early if no group element exists
        if (!groupElement) return

        this._resetVariables()

        this.groupElement = groupElement

        // Get groups element
        await this._getGroupsElement()

        // Exit early if no groups element exists
        if (!this.groupsElement) return

        this.actionsElements = this.groupElement.querySelectorAll('.tah-actions')

        // Exit early if no action elements exist
        if (this.actionsElements.length === 0) return

        // Reset groups elements
        this._resetGroupsElements()

        // Set direction
        this.direction = autoDirection

        // Get group settings
        const nestId = this.groupElement.dataset.nestId
        this.settings = await actionHandler.getGroupSettings({ nestId, level: 1 })

        // Get available width
        this.availableWidth = this._getAvailableWidth()

        // Get groups
        this._getGroupElements()

        // Loop groups
        let hasGrid = false
        for (const groupElement of this.groupElements) {
            const actionsElement = groupElement.querySelector('.tah-actions')
            if (!actionsElement) continue
            const nestId = groupElement.dataset.nestId
            const groupSettings = await actionHandler.getGroupSettings({ nestId })
            const grid = gridModuleSetting || this.settings?.grid || groupSettings?.grid
            if (grid) {
                if (!hasGrid) {
                    await this._getGridWidth()
                    hasGrid = true
                }
                await this._resizeGrid(actionsElement)
            } else {
                await this._resize(actionsElement)
            }
        }

        // Set group height
        await this._setHeight()
    }

    /**
     * Reset variables
     * @private
     */
    _resetVariables () {
        this.actionsElements = null
        this.availableHeight = null
        this.availableWidth = null
        this.direction = null
        this.gridWidth = null
        this.groupElement = null
        this.groupElements = null
        this.groupsElement = null
        this.groupsElementPadding = null
        this.groupsElementRect = null
        this.isCustomWidth = false
        this.minCols = 3
        this.settings = null
        this.spacing = 10
    }

    /**
     * Reset groups elements
     */
    _resetGroupsElements () {
        const level1GroupElement = this.groupElement.closest('.tah-tab-group[data-level="1"]')
        const groupsElements = level1GroupElement.querySelectorAll('.tah-groups')
        const style = { maxHeight: '', overflowY: '' }
        this._resetCSS(groupsElements, style)
    }

    /**
     * Get the grid width
     * @private
     */
    async _getGridWidth () {
        // Reset action elements
        const emptyStyle = { display: '', gridTemplateColumns: '', width: '' }
        await this._resetCSS(this.actionsElements, emptyStyle)

        const actionWidths = []
        const actionWidthsForMedian = []
        for (const actionsElement of this.actionsElements) {
            const actionElements = actionsElement.querySelectorAll('.tah-action:not(.shrink)')
            for (const actionElement of actionElements) {
                const actionRect = actionElement.getBoundingClientRect()
                const actionWidth = Math.round(parseFloat(actionRect.width) + 1 || 0)
                const actionButtonText = actionElement.querySelector('.tah-action-button-text')
                const actionButtonTextRect = actionButtonText.getBoundingClientRect()
                const actionButtonTextWidth = Math.round(parseFloat(actionButtonTextRect.width) || 0)
                actionWidthsForMedian.push(actionWidth)
                actionWidths.push({ actionWidth, actionButtonTextWidth })
            }
        }

        let medianWidth = Math.ceil(Utils.median(actionWidthsForMedian) * 1.1)
        const minActionButtonTextWidth = 30

        for (const actionWidth of actionWidths) {
            const availableactionButtonTextWidth = medianWidth - (actionWidth.actionWidth - actionWidth.actionButtonTextWidth)
            if (availableactionButtonTextWidth < minActionButtonTextWidth) {
                medianWidth = (medianWidth - availableactionButtonTextWidth) + minActionButtonTextWidth
            }
        }

        this.gridWidth = medianWidth
    }

    /**
     * Resize the actions element into the grid format
     * @private
     * @param {object} actionsElement The actions element
     */
    async _resizeGrid (actionsElement) {
        if (!actionsElement) return
        const emptyStyle = { display: '', gridTemplateColumns: '', width: '' }
        await this._assignCSS(actionsElement, emptyStyle)

        const actions = actionsElement.querySelectorAll('.tah-action')
        const squaredCols = Math.ceil(Math.sqrt(actions.length))
        const availableCols = Math.floor(this.availableWidth / this.gridWidth)
        const cols = (squaredCols > availableCols) ? availableCols : (actions.length <= this.minCols) ? actions.length : squaredCols
        // Apply maxHeight and width styles to content
        const style = { display: 'grid', gridTemplateColumns: `repeat(${cols}, ${this.gridWidth}px)` }
        await this._assignCSS(actionsElement, style)
    }

    /**
     * Resize the actions element
     * @private
     * @param {object} actionsElement The actions element
     */
    async _resize (actionsElement) {
        if (!actionsElement) return

        let width = 500
        if (this.isCustomWidth) {
            width = this.availableWidth
        } else {
            // Initialize variables
            let maxActions = 0
            let maxGroupWidth = 0
            // Iterate through action groups, calculating dimensions and counts
            const actions = actionsElement.querySelectorAll('.tah-action')
            if (actions.length > 0) {
                let groupWidth = 0
                actions.forEach((action, index) => {
                    const actionRect = action.getBoundingClientRect()
                    const actionLeft = (index === 0) ? actionRect.left - this.groupsElementRect.left : 0
                    const actionWidth = Math.ceil(parseFloat(actionRect.width) + 1 || 0)
                    groupWidth += actionWidth + actionLeft
                })
                if (groupWidth > maxGroupWidth) {
                    maxGroupWidth = groupWidth
                    maxActions = actions.length
                }
            }

            // Add padding to maxAvgGroupWidth and maxGroupWidth
            maxGroupWidth += (maxActions * 5) - 5
            maxGroupWidth += this.groupsElementPadding
            const medianWidthPerAction = maxGroupWidth / maxActions

            // Determine number of columns
            const defaultCols = 5
            let cols = (maxActions < defaultCols) ? maxActions : defaultCols
            const availableCols = Math.floor(this.availableWidth / medianWidthPerAction)
            const sqrtActionsPerGroup = Math.ceil(Math.sqrt(maxActions))
            if (sqrtActionsPerGroup > cols && sqrtActionsPerGroup <= availableCols) cols = sqrtActionsPerGroup

            // Determine width of content
            width = medianWidthPerAction * cols
            if (width > this.availableWidth) width = this.availableWidth
            if (width < 200) width = 200
        }

        const style = { width: `${width}px` }
        await this._assignCSS(actionsElement, style)
    }

    /**
     * Get available content width
     * @private
     */
    _getAvailableWidth () {
        const customWidth = this.settings?.customWidth

        if (customWidth) {
            this.isCustomWidth = true
            return customWidth
        }

        const windowWidth = canvas.screenDimensions[0]
        const contentLeft = this.groupsElementRect.left
        const uiRight = document.querySelector('#ui-right')
        const uiRightClientWidth = uiRight.clientWidth
        return Math.floor((
            uiRightClientWidth > 0
                ? windowWidth - uiRightClientWidth
                : windowWidth
        ) - this.spacing - contentLeft)
    }

    /**
     * Get available content height
     * @private
     */
    _getAvailableHeight () {
        const windowHeight = canvas.screenDimensions[1]
        const contentBottom = this.groupsElementRect.bottom
        const contentTop = this.groupsElementRect.top
        const uiTopBottom = (this.direction === 'down')
            ? document.querySelector('#ui-bottom')
            : document.querySelector('#ui-top')
        const uiTopBottomOffsetHeight = uiTopBottom.offsetHeight
        const availableHeight = (this.direction === 'down')
            ? windowHeight - contentTop - uiTopBottomOffsetHeight - this.spacing
            : contentBottom - uiTopBottomOffsetHeight - this.spacing
        return Math.floor(availableHeight < 100 ? 100 : availableHeight)
    }

    /**
     * Get content
     * @private
     */
    async _getGroupsElement () {
        this.groupsElement = this.groupElement.querySelector('.tah-groups')
        if (!this.groupsElement) return
        this.groupsElementRect = this.groupsElement.getBoundingClientRect()
        this.groupsElementComputed = getComputedStyle(this.groupsElement)
        this.groupsElementPadding =
            Math.ceil(parseFloat(this.groupsElementComputed.paddingLeft) || 0) +
            Math.ceil(parseFloat(this.groupsElementComputed.paddingRight) || 0)
    }

    /**
     * Get groups
     * @private
     */
    _getGroupElements () {
        this.groupElements = this.groupElement.querySelectorAll('.tah-group')
        if (this.groupElements.length === 0) this.groupElements = [this.groupElement]
    }

    /**
     * Set the content height
     * @private
     */
    async _setHeight () {
        requestAnimationFrame(() => {
            this.availableHeight = this._getAvailableHeight()
            const style = { maxHeight: `${this.availableHeight}px`, overflowY: 'auto' }
            Object.assign(this.groupsElement.style, style)
        })
    }

    /**
     * Assign CSS
     * @private
     * @param {object} element The DOM element
     * @param {object} style   The style
     */
    async _assignCSS (element, style) {
        if (!element) return
        requestAnimationFrame(() => {
            Object.assign(element.style, style)
        })
    }

    /**
     * Reset CSS
     * @private
     * @param {array} elements The DOM elements
     * @param {object} style   The style
     */
    async _resetCSS (elements, style) {
        for (const element of elements) {
            Object.assign(element.style, style)
        }
    }
}
