import { useState } from 'react'

function CompareButton() {
    const [isCompared, setIsCompared] = useState(false)

    const handleCompareClick = () => {
        setIsCompared((currentValue) => !currentValue)
    }

    return (
        <button
            type="button"
            className={`compare-button ${isCompared ? 'active' : ''}`}
            onClick={handleCompareClick}
        >
            {isCompared ? '✓ Added' : 'Add to Compare'}

        </button>
    )
}

export default CompareButton