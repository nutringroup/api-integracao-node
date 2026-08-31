<x-guest-layout>

    <div class="bg-white shadow-md rounded-lg px-8 pt-6 pb-8 mb-4">
        <center><x-application-logo class="w-20 h-20 fill-current text-gray-500" /></center>
        <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-gray-900">
                Bem-vindo de volta
            </h2>
            <p class="mt-2 text-sm text-gray-600">
                Faça login na sua conta
            </p>
        </div>

        <form class="space-y-6" method="POST" action="{{ route('login') }}">
            @csrf

            <div class="space-y-4">
                <div>
                    <input id="email" name="email" type="email" autocomplete="email" required
                        class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                        placeholder="Endereço de email">
                </div>
                <div>
                    <input id="password" name="password" type="password" autocomplete="current-password" required
                        class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-pink-500 focus:border-pink-500 focus:z-10 sm:text-sm"
                        placeholder="Senha">
                </div>
            </div>

            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <input id="remember_me" name="remember" type="checkbox"
                        class="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded">
                    <label for="remember_me" class="ml-2 block text-sm text-gray-900">
                        Lembrar-me
                    </label>
                </div>

                @if (Route::has('password.request'))
                    <div class="text-sm">
                        <a href="{{ route('password.request') }}" class="font-medium text-pink-600 hover:text-pink-500">
                            Esqueceu sua senha?
                        </a>
                    </div>
                @endif
            </div>

            <div>
                <button type="submit"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500">
                    Entrar
                </button>
            </div>
        </form>
    </div>
</x-guest-layout>
