console.log("내 script.js 실행됨!");

const supabaseUrl = "https://dviihusxrbhrmvcwqryn.supabase.co";
const supabaseKey = "sb_publishable_mkYmk_u9tvmIiTH2ALP8Vg_cq4QlEJE";

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const cards = document.querySelectorAll(".draw-card");

// ====================
// 사용자 ID
// ====================

let userId = localStorage.getItem("raffle_user_id");

if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem("raffle_user_id", userId);
}

console.log("내 사용자 ID:", userId);

// ====================
// 기존에 뽑힌 쪽지 상태 불러오기
// ====================

async function loadPickedCards() {

    const { data, error } = await supabaseClient
        .from("save")
        .select("id, content, picked, card_num, picked_by")
        .eq("picked", true);

    if (error) {
        console.error("기존 상태 불러오기 오류:", error);
        return;
    }

    console.log("기존에 뽑힌 쪽지:", data);

    let iHavePicked = false;

    data.forEach(function(save) {

        if (save.card_num === null) {
            return;
        }

        const cardIndex = save.card_num - 1;
        const card = cards[cardIndex];

        if (!card) {
            return;
        }

        // 내가 뽑은 쪽지
        if (save.picked_by === userId) {

            card.querySelector(".card-content").textContent =
                save.content;

            iHavePicked = true;

        }

        // 다른 사람이 뽑은 쪽지
        else {

            card.querySelector(".card-content").textContent =
                "이미 뽑힌 쪽지";

        }

        // 이미 뽑힌 카드는 누구든 다시 클릭할 수 없음
        card.classList.add("selected");
        card.disabled = true;

    });

    // 내가 이미 하나 뽑았다면
    // 나머지 카드도 전부 클릭할 수 없게 함
    if (iHavePicked) {

        cards.forEach(function(card) {

            card.classList.add("selected");
            card.disabled = true;

        });

    }

}

// ====================
// 카드 뽑기
// ====================

cards.forEach(function(card, index) {

    card.addEventListener("click", async function() {

        console.log("카드 클릭됨!");

        // 이미 뽑은 카드면 무시
        if (card.classList.contains("selected")) {
            return;
        }

        // Supabase 함수 실행
        const { data, error } = await supabaseClient
            .rpc("draw_random_save", {
                p_card_number: index + 1,
                p_user_id: userId
            });

        console.log("RPC 결과:", data);
        console.log("RPC 오류:", error);

        // 오류 발생
        if (error) {
            console.error("쪽지 뽑기 오류:", error);
            return;
        }

        // DB에서 선택이 거절된 경우
        if (!data || data.length === 0) {

            // 최신 상태를 DB에서 다시 확인
            await loadPickedCards();

            alert("이미 쪽지를 뽑았거나, 다른 사람이 먼저 뽑은 카드입니다.");

            return;
        }

        // 뽑힌 쪽지
        const selectedNote = data[0];

        // 화면에 내용 표시
        card.querySelector(".card-content").textContent =
            selectedNote.content;

        // 카드 선택 상태
        card.classList.add("selected");
        card.disabled = true;

        // 내가 이미 하나 뽑았으므로
        // 다른 모든 카드도 클릭할 수 없게 함
        cards.forEach(function(otherCard) {

            otherCard.classList.add("selected");
            otherCard.disabled = true;

        });

    });

});


// ====================
// 비밀번호로 초기화 보호
// ====================

const resetButton = document.getElementById("reset-button");

// 원하는 비밀번호로 변경
const resetPassword = "1004";

resetButton.addEventListener("click", async function() {

    // 비밀번호 입력창
    const enteredPassword = prompt("초기화 비밀번호를 입력하세요.");

    // 취소 버튼을 누른 경우
    if (enteredPassword === null) {
        return;
    }

    // 비밀번호 확인
    if (enteredPassword !== resetPassword) {
        alert("비밀번호가 틀렸습니다.");
        return;
    }

    // 초기화 실행
    const { error } = await supabaseClient
        .from("save")
        .update({
            picked: false,
            card_num: null,
            picked_by: null
        })
        .neq("id", 0);

    if (error) {
        console.error("초기화 오류:", error);
        alert("초기화에 실패했습니다.");
        return;
    }

    // 모든 카드 화면 초기화
    cards.forEach(function(card) {
        card.querySelector(".card-content").textContent = "❓";
        card.classList.remove("selected");
        card.disabled = false;
    });

    alert("모든 카드가 초기화되었습니다.");

    console.log("쪽지 초기화 완료!");

});


// ====================
// Supabase Realtime
// ====================

supabaseClient
    .channel("save-realtime")
    .on(
        "postgres_changes",
        {
            event: "UPDATE",
            schema: "public",
            table: "save"
        },
        function(payload) {

            console.log("DB 변경 감지:", payload);

            const changedSave = payload.new;

            // 쪽지가 뽑힌 경우
            if (
                changedSave.picked === true &&
                changedSave.card_num !== null
            ) {
                const cardIndex = changedSave.card_num - 1;
                const card = cards[cardIndex];

                if (card) {

                    // 내가 뽑은 쪽지라면 실제 내용 표시
                    if (changedSave.picked_by === userId) {

                        card.querySelector(".card-content").textContent =
                            changedSave.content;

                    } else {

                        // 다른 사람이 뽑았다면 내용 숨기기
                        card.querySelector(".card-content").textContent =
                            "이미 뽑힌 쪽지";

                    }

                    // 이미 뽑힌 카드는 다시 선택할 수 없음
                    card.classList.add("selected");
                    card.disabled = true;
                }

                // 내가 이미 쪽지를 뽑았다면
                // 나머지 카드도 비활성화
                if (changedSave.picked_by === userId) {

                    cards.forEach(function(otherCard) {
                        otherCard.classList.add("selected");
                        otherCard.disabled = true;
                    });

                }
            }

        // 초기화된 경우
        if (
            changedSave.picked === false &&
            changedSave.card_num === null
        ) {
            cards.forEach(function(card) {

                card.querySelector(".card-content").textContent = "❓";

                card.classList.remove("selected");

                card.disabled = false;

            });
        }
        }
    )
    .subscribe();

    loadPickedCards();

    // ====================
    // 사이드바 열기 / 닫기
    // ====================

    const menuButton = document.getElementById("menu-button");
    const sidebar = document.getElementById("sidebar");
    const closeSidebar = document.getElementById("close-sidebar");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    function openSidebar() {
        sidebar.classList.add("open");
        sidebarOverlay.classList.add("open");
    }

    function closeSidebarMenu() {
        sidebar.classList.remove("open");
        sidebarOverlay.classList.remove("open");
    }

    // 메뉴 버튼 클릭
    menuButton.addEventListener("click", openSidebar);

    // X 버튼 클릭
    closeSidebar.addEventListener("click", closeSidebarMenu);

    // 어두운 배경 클릭
    sidebarOverlay.addEventListener("click", closeSidebarMenu);

    // ESC 키로 닫기
    document.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            closeSidebarMenu();
        }
    });

// ====================
// 사이드바 토글 기능
// ====================

const toggleButtons = document.querySelectorAll(".toggle-button");

toggleButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const targetId = button.dataset.target;
        const content = document.getElementById(targetId);

        if (!content) return;

        content.hidden = !content.hidden;

        button.textContent = content.hidden
            ? button.textContent.replace("▲", "▼")
            : button.textContent.replace("▼", "▲");

    });

});